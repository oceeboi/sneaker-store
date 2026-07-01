import { generateToken, hashPassword } from '@/lib/auth/password';
import { err, ok, requestMeta, validationErr, writeAuditLog } from '@/lib/auth/response';
import {
  ACCESS_COOKIE_NAME,
  accessCookieOptions,
  hashToken,
  issueAccessToken,
  issueRefreshToken,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '@/lib/auth/tokens';
import connect_to_database from '@/lib/db';
import Account from '@/models/Account';
import { AuditAction } from '@/models/Auditlog';
import Referral from '@/models/Referral';
import User, { UserStatus } from '@/models/User';
import UserProfile from '@/models/UserProfile';
import { registerSchema } from '@/schemas/auth.schemas';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const REFERRAL_REWARD_POINTS = 3;

export async function POST(req: NextRequest) {
  await connect_to_database();

  const request_body = await req.json().catch(() => null);
  const validation_result = registerSchema.safeParse(request_body);

  if (!validation_result.success) {
    const validation_issues = validation_result.error.issues.map((issue) => ({
      path: issue.path.map((segment) =>
        typeof segment === 'symbol' ? segment.toString() : segment
      ) as (string | number)[],
      message: issue.message,
    }));

    return validationErr(validation_issues);
  }

  const { email, username, password, referralcode } = validation_result.data;
  const audit_meta = requestMeta(req);
  const incoming_referral_code = referralcode?.trim().toUpperCase() ?? '';

  const [existing_email, existing_username] = await Promise.all([
    User.findOne({ email }).select('_id').lean(),
    User.findOne({ username }).select('_id').lean(),
  ]);

  if (existing_email) return err('An account with this email already exists', 409);
  if (existing_username) return err('This username is already taken', 408);

  if (incoming_referral_code) {
    const existing_referral_code = await Referral.exists({
      referralCode: incoming_referral_code,
    }).lean();

    if (!existing_referral_code) {
      return err('Referral code is invalid.', 400);
    }
  }

  const [password_hash, email_token] = await Promise.all([
    hashPassword(password),
    Promise.resolve(generateToken()),
  ]);

  const email_verification_expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

  const session = await mongoose.startSession();

  const created_user = await session.withTransaction(async () => {
    const [user] = await User.create(
      [
        {
          email,
          username,
          passwordHash: password_hash,
          status: UserStatus.PENDING,
          emailVerifyTokenHash: email_token.hash,
          emailVerifyTokenExp: email_verification_expires_at,
        },
      ],
      { session }
    );
    await create_account({ user_id: user._id, username: user.username, session });

    if (incoming_referral_code) {
      await reward_referrer_by_code(incoming_referral_code, session);
    }

    return user;
  });

  await session.endSession();

  writeAuditLog({
    userId: created_user._id,
    action: AuditAction.USER_REGISTERED,
    entityType: 'User',
    entityId: created_user._id.toString(),
    newValues: { email, username },
    ...audit_meta,
  });

  // ── 7. Issue tokens ───────────────────────────────────────────────────────
  const access_token = issueAccessToken(created_user._id, created_user.username, created_user.role);
  const refresh_token = issueRefreshToken(created_user._id);

  // add the refresh token to the user record (hashed) for future validation
  await User.updateOne(
    { _id: created_user._id },
    {
      $set: {
        refreshTokenHash: hashToken(refresh_token),
      },
    }
  );

  // email notification will be added here
  /**
   * this email function will have params needed so as to help save the function called in the server
   */
  console.log(`[Register] Verification token for ${email}: ${email_token.raw}`);

  const response_body = ok(
    {
      userId: created_user._id.toString(),
      email: created_user.email,
      username: created_user.username,
      status: created_user.status,
      message: 'Account created. Check your email to verify your address.',
    },
    201
  );

  response_body.cookies.set(REFRESH_COOKIE_NAME, refresh_token, refreshCookieOptions);
  // add accesstoken to cookie for easier access in client (optional, can also be stored in memory on client)
  response_body.cookies.set(ACCESS_COOKIE_NAME, access_token, accessCookieOptions);

  return response_body;
}

async function create_referral(
  user_id: mongoose.Types.ObjectId,
  username: string,
  session: mongoose.mongo.ClientSession
): Promise<mongoose.Types.ObjectId> {
  const referral_code = await generate_unique_referral_code(username, session);

  const [created_referral] = await Referral.create(
    [
      {
        userId: user_id,
        referralCode: referral_code,
      },
    ],
    { session }
  );

  return created_referral._id;
}

function build_referral_code_prefix(username: string): string {
  const safe_username = username.replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();
  return `${(safe_username || 'USR').slice(0, 8)}-`;
}

type Params = {
  user_id: mongoose.Types.ObjectId;
  username: string;
  session: mongoose.mongo.ClientSession;
};

async function generate_unique_referral_code(
  username: string,
  session: mongoose.mongo.ClientSession
): Promise<string> {
  const referral_code_prefix = build_referral_code_prefix(username);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const random_suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const referral_code = `${referral_code_prefix}${random_suffix}`.slice(0, 20);

    const existing_referral = await Referral.exists({ referralCode: referral_code }).session(
      session
    );

    if (!existing_referral) {
      return referral_code;
    }
  }

  throw new Error('Unable to generate a unique referral code');
}

async function find_user_by_referral(referral_code: string) {
  return Referral.findOne({ referralCode: referral_code })
    .select('_id userId referralCode successfulReferrals pointsEarned pointsAvailable totalRewards')
    .lean();
}

async function reward_referrer_by_code(
  referral_code: string,
  session: mongoose.mongo.ClientSession
): Promise<void> {
  const normalized_referral_code = referral_code.trim().toUpperCase();
  if (!normalized_referral_code) return;

  const referrer_referral = await find_user_by_referral(normalized_referral_code);
  if (!referrer_referral) {
    throw new Error('Invalid referral code');
  }

  await Referral.updateOne(
    { _id: referrer_referral._id },
    {
      $inc: {
        successfulReferrals: 1,
        pointsEarned: REFERRAL_REWARD_POINTS,
        pointsAvailable: REFERRAL_REWARD_POINTS,
        totalRewards: REFERRAL_REWARD_POINTS,
      },
      $set: {
        lastRewardAt: new Date(),
      },
    },
    { session }
  );
}

async function create_account(params: Params) {
  const [created_referral_id, created_account] = await Promise.all([
    create_referral(params.user_id, params.username, params.session),
    Account.create([{ userId: params.user_id }], { session: params.session }).then(
      ([created_account_record]) => created_account_record
    ),
  ]);

  await UserProfile.create(
    [
      {
        userId: params.user_id,
        referralId: created_referral_id,
        accountId: created_account._id,
      },
    ],
    { session: params.session }
  );
}
