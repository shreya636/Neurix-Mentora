export const LANGUAGES = ["JavaScript", "TypeScript", "Python", "C", "C++", "Java"];

const topics = [
  ["Even or Odd", "Read an integer and print whether it is even or odd.", "Conditionals"],
  ["Largest of Three", "Read three integers and print the largest value.", "Conditionals"],
  ["Leap Year", "Determine whether the given year is a leap year.", "Conditionals"],
  ["Grade Calculator", "Map a score from 0 to 100 to A (90+), B (80â€“89), C (70â€“79), D (60â€“69), or F.", "Conditionals"],
  ["Sum to N", "Read n and print the sum of integers from 1 through n.", "Loops"],
  ["Factorial", "Compute n! for a non-negative integer n.", "Loops"],
  ["Multiplication Table", "Print the first ten multiples of the given integer, one per line.", "Loops"],
  ["Prime Check", "Print whether the given integer is prime.", "Loops"],
  ["Fibonacci Number", "Print the nth Fibonacci number, where F0=0 and F1=1.", "Loops"],
  ["Reverse Digits", "Reverse the digits of a signed integer while preserving its sign.", "Loops"],
  ["Array Sum", "Read n integers and print their sum.", "Arrays"],
  ["Array Maximum", "Read an array of n integers and print its maximum.", "Arrays"],
  ["Array Minimum", "Read an array of n integers and print its minimum.", "Arrays"],
  ["Count Even Numbers", "Count and print the number of even values in an integer array.", "Arrays"],
  ["Second Largest", "Print the second distinct largest value, or -1 if it does not exist.", "Arrays"],
  ["Rotate Array", "Rotate an array right by k positions and print the result.", "Arrays"],
  ["Remove Duplicates", "Print the array values in order, keeping only their first occurrence.", "Arrays"],
  ["Merge Sorted Arrays", "Merge two sorted arrays into one sorted sequence.", "Arrays"],
  ["Two Sum", "Print the zero-based indices of two values that add to target; assume one solution.", "Arrays"],
  ["Move Zeroes", "Move all zeroes to the end while preserving the order of other values.", "Arrays"],
  ["Palindrome String", "Print whether the input string is a palindrome, ignoring case and spaces.", "Strings"],
  ["Count Vowels", "Count vowels (a, e, i, o, u) in the input string, case-insensitively.", "Strings"],
  ["Reverse String", "Print the input string in reverse order.", "Strings"],
  ["Anagram Check", "Print whether two input strings are anagrams, ignoring case and spaces.", "Strings"],
  ["First Unique Character", "Print the index of the first non-repeating character, or -1.", "Strings"],
  ["Word Count", "Count whitespace-separated words in the input line.", "Strings"],
  ["Longest Common Prefix", "Find the longest common prefix of n input strings.", "Strings"],
  ["String Compression", "Compress repeated adjacent characters as character followed by count; keep original if longer.", "Strings"],
  ["Character Frequency", "Print each character and its frequency in order of first appearance.", "Strings"],
  ["Valid Parentheses", "Determine whether (), [], and {} are correctly balanced and nested.", "Data Structures"],
  ["Binary Search", "Return the zero-based index of target in a sorted array, or -1.", "Searching"],
  ["Linear Search", "Return the first zero-based index of target, or -1.", "Searching"],
  ["First and Last Position", "In a sorted array, print the first and last index of target, or -1 -1.", "Searching"],
  ["Bubble Sort", "Sort the given integer array in ascending order.", "Sorting"],
  ["Insertion Sort", "Sort the given integer array in ascending order using insertion sort.", "Sorting"],
  ["Merge Sort", "Sort the given integer array in ascending order using merge sort.", "Sorting"],
  ["Quick Sort", "Sort the given integer array in ascending order using quick sort.", "Sorting"],
  ["Recursive Power", "Compute x raised to a non-negative integer n using recursion.", "Recursion"],
  ["Recursive Digit Sum", "Find the sum of digits of a non-negative integer using recursion.", "Recursion"],
  ["GCD", "Find the greatest common divisor of two non-negative integers.", "Functions"],
  ["LCM", "Find the least common multiple of two positive integers.", "Functions"],
  ["Prefix Sums", "Answer q range-sum queries on an array using prefix sums.", "Arrays"],
  ["Maximum Subarray", "Find the maximum sum of a non-empty contiguous subarray.", "Dynamic Programming"],
  ["Climbing Stairs", "Count ways to climb n steps taking either 1 or 2 steps at a time.", "Dynamic Programming"],
  ["Coin Change", "Find the minimum number of coins to make amount, or -1 if impossible.", "Dynamic Programming"],
  ["Grid Path Count", "Count paths from top-left to bottom-right moving only right or down in an m by n grid.", "Dynamic Programming"],
  ["Stack Operations", "Process push, pop, and top operations and print each requested result.", "Data Structures"],
  ["Queue Operations", "Process enqueue, dequeue, and front operations and print each requested result.", "Data Structures"],
  ["Frequency Sort", "Sort integers by increasing frequency; break ties by increasing value.", "Sorting"],
  ["Isomorphic Strings", "Determine whether characters in two strings map one-to-one consistently.", "Strings"]
];

// Keep each visible sample input paired with an output for that specific prompt.
// Inputs use the stated problem's conventional format; they are real test cases,
// not a shared placeholder copied across unrelated questions.
const samples = [
  ["7", "Odd"],
  ["3 9 5", "9"],
  ["2024", "Leap Year"],
  ["85", "B"],
  ["5", "15"],
  ["5", "120"],
  ["3", "3\\n6\\n9\\n12\\n15\\n18\\n21\\n24\\n27\\n30"],
  ["7", "Prime"],
  ["7", "13"],
  ["-123", "-321"],
  ["5\\n1 2 3 4 5", "15"],
  ["5\\n1 2 3 4 5", "5"],
  ["5\\n1 2 3 4 5", "1"],
  ["5\\n1 2 3 4 5", "2"],
  ["5\\n1 2 3 4 5", "4"],
  ["5 2\\n1 2 3 4 5", "4 5 1 2 3"],
  ["6\\n1 2 2 3 1 4", "1 2 3 4"],
  ["3 2\\n1 3 5\\n2 4", "1 2 3 4 5"],
  ["4 9\\n2 7 11 15", "0 1"],
  ["5\\n0 1 0 3 12", "1 3 12 0 0"],
  ["racecar", "true"],
  ["education", "5"],
  ["Mentora", "arotneM"],
  ["listen\\nsilent", "true"],
  ["swiss", "1"],
  ["hello world from mentora", "4"],
  ["5\\nflower flow flight flat flap", "fl"],
  ["aaabbc", "a3b2c1"],
  ["banana", "b 1\\na 3\\nn 2"],
  ["([]{})", "true"],
  ["6\\n1 3 5 7 9 11\\n7", "3"],
  ["5\\n4 2 7 1 9\\n7", "2"],
  ["6\\n1 2 2 2 3 4\\n2", "1 3"],
  ["5\\n5 1 4 2 8", "1 2 4 5 8"],
  ["5\\n5 1 4 2 8", "1 2 4 5 8"],
  ["5\\n5 1 4 2 8", "1 2 4 5 8"],
  ["5\\n5 1 4 2 8", "1 2 4 5 8"],
  ["2 10", "1024"],
  ["9875", "29"],
  ["48 18", "6"],
  ["4 6", "12"],
  ["5 3\\n1 2 3 4 5\\n1 3\\n2 5\\n1 5", "6\\n14\\n15"],
  ["9\\n-2 1 -3 4 -1 2 1 -5 4", "6"],
  ["5", "8"],
  ["3 11\\n1 2 5", "3"],
  ["3 3", "6"],
  ["5\\npush 1\\npush 2\\ntop\\npop\\ntop", "2\\n2\\n1"],
  ["5\\nenqueue 1\\nenqueue 2\\nfront\\ndequeue\\nfront", "1\\n1\\n2"],
  ["6\\n4 5 6 5 4 3", "3 6 4 4 5 5"],
  ["egg\\nadd", "true"]
];

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
export const QUESTIONS = topics.map(([title, statement, category], i) => ({
  id: i + 1, title, statement, category,
  difficulty: i < 20 ? "Easy" : i < 40 ? "Medium" : "Hard",
  input: "Input is provided on standard input as described by the problem. Integers are whitespace-separated; strings may occupy a full line.",
  output: "Print the requested answer to standard output. Do not print prompts or extra labels.",
  sampleIn: samples[i][0].replace(/\\n/g, "\n"),
  sampleOut: samples[i][1].replace(/\\n/g, "\n"),
  constraints: "1 â‰¤ n â‰¤ 100,000; -10â¹ â‰¤ values â‰¤ 10â¹. Handle boundary cases and duplicates where applicable.",
  requirement: `Implement ${title} with an appropriate algorithm. Aim for O(n) time when possible and explain edge cases.`,
  tests: [{ input: samples[i][0].replace(/\\n/g, "\n"), expected: samples[i][1].replace(/\\n/g, "\n") }]
}));

export function starter(language, q) {
  const label = q.title;
  return {
    JavaScript: `// ${label}\n// Read from stdin and write the answer to stdout.\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf8').trim();\n// TODO: implement\nconsole.log(input);`,
    TypeScript: `// ${label}\nimport * as fs from 'fs';\nconst input: string = fs.readFileSync(0, 'utf8').trim();\n// TODO: implement\nconsole.log(input);`,
    Python: `# ${label}\nimport sys\ndata = sys.stdin.read().strip()\n# TODO: implement\nprint(data)`,
    C: `#include <stdio.h>\nint main(void) {\n    // ${label}\n    // TODO: read stdin, solve, and print the answer\n    return 0;\n}`,
    "C++": `#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    // ${label}\n    // TODO: read stdin, solve, and print the answer\n    return 0;\n}`,
    Java: `import java.util.*;\npublic class Main {\n  public static void main(String[] args) {\n    // ${label}\n    // TODO: read stdin, solve, and print the answer\n  }\n}`
  }[language];
}

export function renderCodingPractice(student) {
  const q = QUESTIONS.find(x => x.id === Number(window.__codingQuestionId)) || QUESTIONS[0];
  const lang = LANGUAGES.includes(window.__codingLanguage) ? window.__codingLanguage : "JavaScript";
  const code = window.__codingCode ?? starter(lang, q);
  const results = window.__codingResults;
  const questions = QUESTIONS.map(item => '<button class="coding-question ' + (item.id === q.id ? 'active' : '') + '" data-action="coding-question" data-id="' + item.id + '"><span>' + item.id + '. ' + esc(item.title) + '</span><small>' + item.difficulty + ' · ' + item.category + '</small></button>').join('');
  const languages = LANGUAGES.map(item => '<option ' + (item === lang ? 'selected' : '') + '>' + item + '</option>').join('');
  const tests = results?.tests ? results.tests.map((t, i) => '<article class="coding-test ' + (t.passed ? 'passed' : 'failed') + '"><strong>Test ' + (i+1) + ': ' + (t.passed ? 'Passed' : 'Failed') + ' · ' + esc(t.status || t.judge0Status || 'Execution result') + '</strong><div><small>Expected</small><pre>' + esc(t.expected ?? '') + '</pre><small>Actual</small><pre>' + esc(t.actual ?? '') + '</pre></div>' + (t.error ? '<small>Compiler / runtime details</small><pre>' + esc(t.error) + '</pre>' : '') + '</article>').join('') : '';
  const review = results?.review ? esc(results.review) : 'Run your solution to receive a review of your actual code and test results.';
  const lineNumbers = code.split('\n').map((_, i) => '<span>' + (i+1) + '</span>').join('');
  return '<div class="student-portal student-workspace"><aside class="student-sidebar"><a class="landing-brand" href="/student" data-route-screen="student-dashboard"><img class="portal-sidebar-logo" src="/mentora-logo.png" alt="Mentora"/></a><p class="student-side-label">LEARNING SPACE</p><nav aria-label="Student portal"><a class="student-side-link" href="/student" data-route-screen="student-dashboard">Overview</a><a class="student-side-link active" href="/student/coding-practice">Coding Practice</a><a class="student-side-link" href="/student/visualize" data-route-screen="student-visualize">Visualize My Doubt</a><a class="student-side-link" href="/student/ai" data-route-screen="student-ai">AI Assistant</a></nav><div class="student-side-footer"><button class="student-side-link" data-action="student-logout">Log out</button></div></aside><main class="student-content coding-page"><header class="student-workspace-topbar"><span>Engineering mentor <b>/</b> Coding Practice</span><button class="btn-secondary" data-action="return-student-dashboard">← Overview</button></header><h1>Coding Practice</h1><p class="coding-lede">Solve a challenge, run it against real test cases, and get feedback on your submitted code.</p><div class="coding-layout"><aside class="coding-left"><section class="coding-question-list"><h2>50 Challenges</h2><div>' + questions + '</div></section><section class="coding-review"><h2>AI Code Review</h2><p>' + review + '</p></section></aside><section class="coding-main"><article class="coding-problem"><span class="coding-badge">' + q.difficulty + ' · ' + q.category + '</span><h2>' + esc(q.title) + '</h2><p>' + esc(q.statement) + '</p><dl><dt>Input format</dt><dd>' + esc(q.input) + '</dd><dt>Output format</dt><dd>' + esc(q.output) + '</dd><dt>Sample input</dt><dd><pre>' + esc(q.sampleIn) + '</pre></dd><dt>Sample output</dt><dd><pre>' + esc(q.sampleOut) + '</pre></dd><dt>Constraints</dt><dd>' + esc(q.constraints) + '</dd><dt>Expected solution</dt><dd>' + esc(q.requirement) + '</dd></dl></article><div class="coding-editor-card"><label for="coding-language">Language</label><select id="coding-language" class="select">' + languages + '</select><div class="coding-editor"><div class="coding-lines" aria-hidden="true">' + lineNumbers + '</div><textarea id="coding-source" spellcheck="false" aria-label="Code editor">' + esc(code) + '</textarea></div><div class="coding-run-row"><button class="btn-primary" data-action="coding-run" ' + (window.__codingRunning ? 'disabled' : '') + '>' + (window.__codingRunning ? 'Running…' : 'Run Code') + '</button>' + (results?.status ? '<span class="coding-status ' + (results.ok ? 'passed' : 'failed') + '">' + esc(results.status) + '</span>' : '') + '</div><div class="coding-results">' + tests + '</div></div></section></div></main></div>';
}
