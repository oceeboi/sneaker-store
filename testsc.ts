type StudentScore = {
  name: string;
  score: number;
};

type StudentGrade = StudentScore & {
  grade: string;
};

function assignGrade(student: StudentScore): StudentGrade {
  let grade: string;

  if (student.score >= 90) {
    grade = 'A';
  } else if (student.score >= 80) {
    grade = 'B';
  } else if (student.score >= 70) {
    grade = 'C';
  } else if (student.score >= 60) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  return { ...student, grade };
}

let students: StudentScore[] = [
  { name: 'Alice', score: 95 },
  { name: 'Bob', score: 82 },
  { name: 'Charlie', score: 67 },
  { name: 'David', score: 58 },
];

let gradedStudents: StudentGrade[] = students.map(assignGrade);

console.log(gradedStudents);

// loop through an array of students and assign grades

let gradedStudentsLoop: StudentGrade[] = [];
for (let student of students) {
  gradedStudentsLoop.push(assignGrade(student));
}

console.log(gradedStudentsLoop);
