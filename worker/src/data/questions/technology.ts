import type { QuestionSource } from "../../game/types";

export const technologyQuestions: QuestionSource[] = [
  { id: "tech-e1", category: "technology", difficulty: "easy", question: "What does \"CPU\" stand for?", answers: ["Computer Personal Unit", "Central Processing Unit", "Central Program Utility", "Core Processing Unit"], correctAnswer: 1 },
  { id: "tech-e2", category: "technology", difficulty: "easy", question: "Which company makes the iPhone?", answers: ["Samsung", "Google", "Apple", "Microsoft"], correctAnswer: 2 },
  { id: "tech-e3", category: "technology", difficulty: "easy", question: "Which of these is a web browser?", answers: ["Firefox", "Excel", "Photoshop", "Spotify"], correctAnswer: 0 },
  { id: "tech-e4", category: "technology", difficulty: "easy", question: "On Windows, which shortcut usually copies selected text?", answers: ["Ctrl + V", "Ctrl + X", "Ctrl + Z", "Ctrl + C"], correctAnswer: 3 },
  { id: "tech-e5", category: "technology", difficulty: "easy", question: "What does \"USB\" stand for?", answers: ["United System Board", "Universal Serial Bus", "Universal Signal Bridge", "User Serial Bus"], correctAnswer: 1 },
  { id: "tech-m1", category: "technology", difficulty: "medium", question: "What does \"RAM\" stand for?", answers: ["Random Access Memory", "Read Access Memory", "Rapid Application Memory", "Runtime Allocated Memory"], correctAnswer: 0 },
  { id: "tech-m2", category: "technology", difficulty: "medium", question: "Who co-founded Microsoft with Bill Gates?", answers: ["Steve Jobs", "Steve Wozniak", "Paul Allen", "Larry Page"], correctAnswer: 2 },
  { id: "tech-m3", category: "technology", difficulty: "medium", question: "How many bits are in a byte?", answers: ["4", "16", "32", "8"], correctAnswer: 3 },
  { id: "tech-m4", category: "technology", difficulty: "medium", question: "What does \"HTTP\" stand for?", answers: ["High Transfer Text Protocol", "HyperText Transfer Protocol", "HyperText Transmission Process", "Hyperlink Text Transfer Protocol"], correctAnswer: 1 },
  { id: "tech-m5", category: "technology", difficulty: "medium", question: "Which company acquired Android Inc. in 2005?", answers: ["Apple", "Microsoft", "Google", "Nokia"], correctAnswer: 2 },
  { id: "tech-h1", category: "technology", difficulty: "hard", question: "In what year was the first iPhone released?", answers: ["2007", "2005", "2008", "2010"], correctAnswer: 0 },
  { id: "tech-h2", category: "technology", difficulty: "hard", question: "Which 1993 browser is credited with popularizing the graphical World Wide Web?", answers: ["Netscape Navigator", "Mosaic", "Internet Explorer", "Opera"], correctAnswer: 1 },
  { id: "tech-h3", category: "technology", difficulty: "hard", question: "What does \"ASCII\" stand for?", answers: ["Advanced System Code for Internet Interaction", "American Software Code for Integrated Interfaces", "Automated Standard Character Information Index", "American Standard Code for Information Interchange"], correctAnswer: 3 },
  { id: "tech-h4", category: "technology", difficulty: "hard", question: "Which port does HTTPS use by default?", answers: ["80", "8080", "443", "22"], correctAnswer: 2 },
  { id: "tech-h5", category: "technology", difficulty: "hard", question: "Moore's Law is commonly stated as transistor counts doubling about every…", answers: ["Two years", "Five years", "Ten years", "Six months"], correctAnswer: 0 },
];
