import type { QuestionSource } from "../../game/types";

export const geographyQuestions: QuestionSource[] = [
  { id: "geo-e1", category: "geography", difficulty: "easy", question: "What is the capital of Japan?", answers: ["Seoul", "Tokyo", "Beijing", "Bangkok"], correctAnswer: 1 },
  { id: "geo-e2", category: "geography", difficulty: "easy", question: "What is the largest ocean on Earth?", answers: ["Atlantic", "Indian", "Arctic", "Pacific"], correctAnswer: 3 },
  { id: "geo-e3", category: "geography", difficulty: "easy", question: "On which continent is Brazil?", answers: ["South America", "Africa", "Asia", "Europe"], correctAnswer: 0 },
  { id: "geo-e4", category: "geography", difficulty: "easy", question: "What is the capital of France?", answers: ["Lyon", "Marseille", "Paris", "Nice"], correctAnswer: 2 },
  { id: "geo-e5", category: "geography", difficulty: "easy", question: "Which is the largest country by area?", answers: ["Canada", "Russia", "China", "United States"], correctAnswer: 1 },
  { id: "geo-m1", category: "geography", difficulty: "medium", question: "What is the longest river in Africa?", answers: ["Congo", "Niger", "Nile", "Zambezi"], correctAnswer: 2 },
  { id: "geo-m2", category: "geography", difficulty: "medium", question: "What is the capital of Australia?", answers: ["Canberra", "Sydney", "Melbourne", "Perth"], correctAnswer: 0 },
  { id: "geo-m3", category: "geography", difficulty: "medium", question: "Mount Everest sits on the border between Nepal and which country?", answers: ["India", "Bhutan", "Pakistan", "China"], correctAnswer: 3 },
  { id: "geo-m4", category: "geography", difficulty: "medium", question: "Which country has the largest population?", answers: ["China", "India", "United States", "Indonesia"], correctAnswer: 1 },
  { id: "geo-m5", category: "geography", difficulty: "medium", question: "What is the smallest country in the world by area?", answers: ["Monaco", "San Marino", "Vatican City", "Liechtenstein"], correctAnswer: 2 },
  { id: "geo-h1", category: "geography", difficulty: "hard", question: "What is the capital of Kazakhstan?", answers: ["Astana", "Almaty", "Tashkent", "Bishkek"], correctAnswer: 0 },
  { id: "geo-h2", category: "geography", difficulty: "hard", question: "What is the largest hot desert in the world?", answers: ["Gobi", "Kalahari", "Arabian", "Sahara"], correctAnswer: 3 },
  { id: "geo-h3", category: "geography", difficulty: "hard", question: "Lake Baikal, the world's deepest lake, is in which country?", answers: ["Mongolia", "Russia", "Kazakhstan", "China"], correctAnswer: 1 },
  { id: "geo-h4", category: "geography", difficulty: "hard", question: "Which country has three capital cities?", answers: ["Nigeria", "Kenya", "South Africa", "Egypt"], correctAnswer: 2 },
  { id: "geo-h5", category: "geography", difficulty: "hard", question: "Which river flows through the most countries?", answers: ["Danube", "Nile", "Amazon", "Rhine"], correctAnswer: 0 },
];
