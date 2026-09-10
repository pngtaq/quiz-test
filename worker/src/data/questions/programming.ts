import type { QuestionSource } from "../../game/types";

export const programmingQuestions: QuestionSource[] = [
  { id: "prog-e1", category: "programming", difficulty: "easy", question: "What does HTML stand for?", answers: ["HyperText Markup Language", "High Tech Modern Language", "Hyperlink and Text Management Language", "Home Tool Markup Language"], correctAnswer: 0 },
  { id: "prog-e2", category: "programming", difficulty: "easy", question: "Which characters start a single-line comment in JavaScript?", answers: ["#", "<!--", "//", "--"], correctAnswer: 2 },
  { id: "prog-e3", category: "programming", difficulty: "easy", question: "What does CSS mainly control on a web page?", answers: ["Database queries", "Styling and layout", "Server routing", "Memory allocation"], correctAnswer: 1 },
  { id: "prog-e4", category: "programming", difficulty: "easy", question: "Which of these is a version control system?", answers: ["Node", "Docker", "Nginx", "Git"], correctAnswer: 3 },
  { id: "prog-e5", category: "programming", difficulty: "easy", question: "Besides true, what is the other boolean value?", answers: ["null", "false", "0", "undefined"], correctAnswer: 1 },
  { id: "prog-m1", category: "programming", difficulty: "medium", question: "Which HTTP status code means \"Not Found\"?", answers: ["200", "301", "404", "500"], correctAnswer: 2 },
  { id: "prog-m2", category: "programming", difficulty: "medium", question: "What does SQL stand for?", answers: ["Structured Query Language", "Simple Question Language", "Sequential Query Logic", "Standard Queue Language"], correctAnswer: 0 },
  { id: "prog-m3", category: "programming", difficulty: "medium", question: "Which data structure is Last In, First Out (LIFO)?", answers: ["Queue", "Stack", "Linked list", "Hash map"], correctAnswer: 1 },
  { id: "prog-m4", category: "programming", difficulty: "medium", question: "Which keyword declares a block-scoped constant in JavaScript?", answers: ["var", "let", "static", "const"], correctAnswer: 3 },
  { id: "prog-m5", category: "programming", difficulty: "medium", question: "What is the index of the first element in a JavaScript array?", answers: ["1", "-1", "0", "It depends on the array"], correctAnswer: 2 },
  { id: "prog-h1", category: "programming", difficulty: "hard", question: "What is the average-case lookup time of a hash table?", answers: ["O(1)", "O(log n)", "O(n)", "O(n log n)"], correctAnswer: 0 },
  { id: "prog-h2", category: "programming", difficulty: "hard", question: "What is the worst-case time complexity of quicksort?", answers: ["O(n log n)", "O(n)", "O(n²)", "O(log n)"], correctAnswer: 2 },
  { id: "prog-h3", category: "programming", difficulty: "hard", question: "Who created the Python programming language?", answers: ["James Gosling", "Guido van Rossum", "Bjarne Stroustrup", "Dennis Ritchie"], correctAnswer: 1 },
  { id: "prog-h4", category: "programming", difficulty: "hard", question: "Which Git command creates a new commit that undoes an earlier commit?", answers: ["git reset", "git checkout", "git restore", "git revert"], correctAnswer: 3 },
  { id: "prog-h5", category: "programming", difficulty: "hard", question: "In the SOLID principles, what does the \"L\" stand for?", answers: ["Liskov Substitution Principle", "Layered Architecture Principle", "Loose Coupling Principle", "Lazy Loading Principle"], correctAnswer: 0 },
];
