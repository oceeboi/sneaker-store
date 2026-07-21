import { Sheet } from '@/components/shared/sheet';

export function Cart_Container({
  onOpenChange,
  open,
  mobile,
}: {
  open?: boolean;
  /** Called whenever the sheet wants to open or close. */

  onOpenChange?: (open: boolean) => void;

  // mobile-bottom nav

  mobile?: boolean;
}) {
  let cartItems: number = 2;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <Sheet.Trigger asChild>
        <button className="btn">
          <div className="relative">
            {mobile ? (
              <div className="group flex flex-col items-center justify-center relative py-1 text-gray-500 hover:text-black transition-colors">
                <div className="h-5 w-5 shrink-0 transition-transform active:scale-95">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 32 32">
                    <path d="M25.248 22.4l3.552-14.4h-18.528l-0.96-4.8h-6.112v3.2h3.488l3.2 16h15.36zM24.704 11.2l-1.968 8h-10.24l-1.6-8h13.808z"></path>
                    <path d="M25.6 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
                    <path d="M14.4 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
                  </svg>
                </div>

                <span className="mt-1.5 text-[11px] font-medium tracking-wide">Cart</span>
                {cartItems > 0 && (
                  <div className="absolute -top-1.5 -right-2.5">
                    <div className="bg-black min-w-4.5 h-[4.5 px-1 rounded-full text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {cartItems < 10 ? cartItems : '10+'}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <svg
                  width="24"
                  height="24"
                  aria-hidden="true"
                  role="img"
                  focusable="false"
                  viewBox="0 0 32 32"
                  fill={mobile ? 'black' : 'white'}
                >
                  <path d="M25.248 22.4l3.552-14.4h-18.528l-0.96-4.8h-6.112v3.2h3.488l3.2 16h15.36zM24.704 11.2l-1.968 8h-10.24l-1.6-8h13.808z"></path>
                  <path d="M25.6 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
                  <path d="M14.4 26.4c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z"></path>
                </svg>
                {cartItems > 0 && (
                  <div className="absolute -top-1.5 -right-2.5">
                    <div className="bg-white min-w-4.5 h-[4.5 px-1 rounded-full text-black flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {cartItems < 10 ? cartItems : '10+'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </button>
      </Sheet.Trigger>

      <Sheet.Content side="right" size="md" className="h-full bg-white">
        <Sheet.Header>
          <Sheet.Title className="text-black">
            <div className="text-[18px] font-medium">Shopping Cart</div>
          </Sheet.Title>
        </Sheet.Header>
        <div className="px-6 py-2 overflow-y-auto">
          {/* your content — full control */}
          <div className="text-black">cart working here....</div>
        </div>
      </Sheet.Content>
    </Sheet>
  );
}
