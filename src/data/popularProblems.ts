import type { Difficulty } from '../types';

export interface PopularProblemMeta {
  title: string;
  difficulty: Difficulty;
  topics: string[];
}

/**
 * Built-in metadata dictionary for top/popular LeetCode problems (Blind 75, Top Interview 150, Grind 75).
 * Guarantees that problems like "two-sum" always have their true difficulty and topics offline.
 */
export const POPULAR_PROBLEMS: Record<string, PopularProblemMeta> = {
  'two-sum': { title: 'Two Sum', difficulty: 'Easy', topics: ['Array', 'Hash Table'] },
  'add-two-numbers': { title: 'Add Two Numbers', difficulty: 'Medium', topics: ['Linked List', 'Math', 'Recursion'] },
  'longest-substring-without-repeating-characters': {
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    topics: ['Hash Table', 'String', 'Sliding Window'],
  },
  'median-of-two-sorted-arrays': {
    title: 'Median of Two Sorted Arrays',
    difficulty: 'Hard',
    topics: ['Array', 'Binary Search', 'Divide and Conquer'],
  },
  'longest-palindromic-substring': {
    title: 'Longest Palindromic Substring',
    difficulty: 'Medium',
    topics: ['Two Pointers', 'String', 'Dynamic Programming'],
  },
  'zigzag-conversion': { title: 'Zigzag Conversion', difficulty: 'Medium', topics: ['String'] },
  'reverse-integer': { title: 'Reverse Integer', difficulty: 'Medium', topics: ['Math'] },
  'string-to-integer-atoi': { title: 'String to Integer (atoi)', difficulty: 'Medium', topics: ['String'] },
  'palindrome-number': { title: 'Palindrome Number', difficulty: 'Easy', topics: ['Math'] },
  'regular-expression-matching': {
    title: 'Regular Expression Matching',
    difficulty: 'Hard',
    topics: ['String', 'Dynamic Programming', 'Recursion'],
  },
  'container-with-most-water': {
    title: 'Container With Most Water',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Greedy'],
  },
  'roman-to-integer': { title: 'Roman to Integer', difficulty: 'Easy', topics: ['Hash Table', 'Math', 'String'] },
  'longest-common-prefix': { title: 'Longest Common Prefix', difficulty: 'Easy', topics: ['String', 'Trie'] },
  '3sum': { title: '3Sum', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Sorting'] },
  '3sum-closest': { title: '3Sum Closest', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Sorting'] },
  'letter-combinations-of-a-phone-number': {
    title: 'Letter Combinations of a Phone Number',
    difficulty: 'Medium',
    topics: ['Hash Table', 'String', 'Backtracking'],
  },
  '4sum': { title: '4Sum', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Sorting'] },
  'remove-nth-node-from-end-of-list': {
    title: 'Remove Nth Node From End of List',
    difficulty: 'Medium',
    topics: ['Linked List', 'Two Pointers'],
  },
  'valid-parentheses': { title: 'Valid Parentheses', difficulty: 'Easy', topics: ['String', 'Stack'] },
  'merge-two-sorted-lists': {
    title: 'Merge Two Sorted Lists',
    difficulty: 'Easy',
    topics: ['Linked List', 'Recursion'],
  },
  'generate-parentheses': {
    title: 'Generate Parentheses',
    difficulty: 'Medium',
    topics: ['String', 'Dynamic Programming', 'Backtracking'],
  },
  'merge-k-sorted-lists': {
    title: 'Merge k Sorted Lists',
    difficulty: 'Hard',
    topics: ['Linked List', 'Divide and Conquer', 'Heap (Priority Queue)', 'Merge Sort'],
  },
  'swap-nodes-in-pairs': { title: 'Swap Nodes in Pairs', difficulty: 'Medium', topics: ['Linked List', 'Recursion'] },
  'reverse-nodes-in-k-group': {
    title: 'Reverse Nodes in k-Group',
    difficulty: 'Hard',
    topics: ['Linked List', 'Recursion'],
  },
  'remove-duplicates-from-sorted-array': {
    title: 'Remove Duplicates from Sorted Array',
    difficulty: 'Easy',
    topics: ['Array', 'Two Pointers'],
  },
  'remove-element': { title: 'Remove Element', difficulty: 'Easy', topics: ['Array', 'Two Pointers'] },
  'find-the-index-of-the-first-occurrence-in-a-string': {
    title: 'Find the Index of the First Occurrence in a String',
    difficulty: 'Easy',
    topics: ['Two Pointers', 'String', 'String Matching'],
  },
  'search-in-rotated-sorted-array': {
    title: 'Search in Rotated Sorted Array',
    difficulty: 'Medium',
    topics: ['Array', 'Binary Search'],
  },
  'find-first-and-last-position-of-element-in-sorted-array': {
    title: 'Find First and Last Position of Element in Sorted Array',
    difficulty: 'Medium',
    topics: ['Array', 'Binary Search'],
  },
  'search-insert-position': { title: 'Search Insert Position', difficulty: 'Easy', topics: ['Array', 'Binary Search'] },
  'valid-sudoku': { title: 'Valid Sudoku', difficulty: 'Medium', topics: ['Array', 'Hash Table', 'Matrix'] },
  'combination-sum': { title: 'Combination Sum', difficulty: 'Medium', topics: ['Array', 'Backtracking'] },
  'combination-sum-ii': { title: 'Combination Sum II', difficulty: 'Medium', topics: ['Array', 'Backtracking'] },
  'trapping-rain-water': {
    title: 'Trapping Rain Water',
    difficulty: 'Hard',
    topics: ['Array', 'Two Pointers', 'Dynamic Programming', 'Stack', 'Monotonic Stack'],
  },
  'multiply-strings': { title: 'Multiply Strings', difficulty: 'Medium', topics: ['Math', 'String', 'Simulation'] },
  permutations: { title: 'Permutations', difficulty: 'Medium', topics: ['Array', 'Backtracking'] },
  'permutations-ii': { title: 'Permutations II', difficulty: 'Medium', topics: ['Array', 'Backtracking'] },
  'rotate-image': { title: 'Rotate Image', difficulty: 'Medium', topics: ['Array', 'Math', 'Matrix'] },
  'group-anagrams': {
    title: 'Group Anagrams',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'String', 'Sorting'],
  },
  'powx-n': { title: 'Pow(x, n)', difficulty: 'Medium', topics: ['Math', 'Recursion'] },
  'maximum-subarray': {
    title: 'Maximum Subarray',
    difficulty: 'Medium',
    topics: ['Array', 'Divide and Conquer', 'Dynamic Programming'],
  },
  'spiral-matrix': { title: 'Spiral Matrix', difficulty: 'Medium', topics: ['Array', 'Matrix', 'Simulation'] },
  'jump-game': { title: 'Jump Game', difficulty: 'Medium', topics: ['Array', 'Dynamic Programming', 'Greedy'] },
  'merge-intervals': { title: 'Merge Intervals', difficulty: 'Medium', topics: ['Array', 'Sorting'] },
  'insert-interval': { title: 'Insert Interval', difficulty: 'Medium', topics: ['Array'] },
  'length-of-last-word': { title: 'Length of Last Word', difficulty: 'Easy', topics: ['String'] },
  'spiral-matrix-ii': { title: 'Spiral Matrix II', difficulty: 'Medium', topics: ['Array', 'Matrix', 'Simulation'] },
  'permutation-sequence': { title: 'Permutation Sequence', difficulty: 'Hard', topics: ['Math', 'Recursion'] },
  'rotate-list': { title: 'Rotate List', difficulty: 'Medium', topics: ['Linked List', 'Two Pointers'] },
  'unique-paths': {
    title: 'Unique Paths',
    difficulty: 'Medium',
    topics: ['Math', 'Dynamic Programming', 'Combinatorics'],
  },
  'unique-paths-ii': {
    title: 'Unique Paths II',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming', 'Matrix'],
  },
  'minimum-path-sum': {
    title: 'Minimum Path Sum',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming', 'Matrix'],
  },
  'climbing-stairs': {
    title: 'Climbing Stairs',
    difficulty: 'Easy',
    topics: ['Math', 'Dynamic Programming', 'Memoization'],
  },
  'set-matrix-zeroes': { title: 'Set Matrix Zeroes', difficulty: 'Medium', topics: ['Array', 'Hash Table', 'Matrix'] },
  'search-a-2d-matrix': {
    title: 'Search a 2D Matrix',
    difficulty: 'Medium',
    topics: ['Array', 'Binary Search', 'Matrix'],
  },
  'sort-colors': { title: 'Sort Colors', difficulty: 'Medium', topics: ['Array', 'Two Pointers', 'Sorting'] },
  'minimum-window-substring': {
    title: 'Minimum Window Substring',
    difficulty: 'Hard',
    topics: ['Hash Table', 'String', 'Sliding Window'],
  },
  subsets: { title: 'Subsets', difficulty: 'Medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'] },
  'word-search': {
    title: 'Word Search',
    difficulty: 'Medium',
    topics: ['Array', 'String', 'Backtracking', 'Matrix'],
  },
  'remove-duplicates-from-sorted-array-ii': {
    title: 'Remove Duplicates from Sorted Array II',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers'],
  },
  'search-in-rotated-sorted-array-ii': {
    title: 'Search in Rotated Sorted Array II',
    difficulty: 'Medium',
    topics: ['Array', 'Binary Search'],
  },
  'remove-duplicates-from-sorted-list': {
    title: 'Remove Duplicates from Sorted List',
    difficulty: 'Easy',
    topics: ['Linked List'],
  },
  'remove-duplicates-from-sorted-list-ii': {
    title: 'Remove Duplicates from Sorted List II',
    difficulty: 'Medium',
    topics: ['Linked List', 'Two Pointers'],
  },
  'largest-rectangle-in-histogram': {
    title: 'Largest Rectangle in Histogram',
    difficulty: 'Hard',
    topics: ['Array', 'Stack', 'Monotonic Stack'],
  },
  'maximal-rectangle': {
    title: 'Maximal Rectangle',
    difficulty: 'Hard',
    topics: ['Array', 'Dynamic Programming', 'Stack', 'Matrix', 'Monotonic Stack'],
  },
  'partition-list': { title: 'Partition List', difficulty: 'Medium', topics: ['Linked List', 'Two Pointers'] },
  'merge-sorted-array': {
    title: 'Merge Sorted Array',
    difficulty: 'Easy',
    topics: ['Array', 'Two Pointers', 'Sorting'],
  },
  'subsets-ii': { title: 'Subsets II', difficulty: 'Medium', topics: ['Array', 'Backtracking', 'Bit Manipulation'] },
  'decode-ways': { title: 'Decode Ways', difficulty: 'Medium', topics: ['String', 'Dynamic Programming'] },
  'reverse-linked-list-ii': { title: 'Reverse Linked List II', difficulty: 'Medium', topics: ['Linked List'] },
  'validate-binary-search-tree': {
    title: 'Validate Binary Search Tree',
    difficulty: 'Medium',
    topics: ['Tree', 'Depth-First Search', 'Binary Search Tree', 'Binary Tree'],
  },
  'recover-binary-search-tree': {
    title: 'Recover Binary Search Tree',
    difficulty: 'Medium',
    topics: ['Tree', 'Depth-First Search', 'Binary Search Tree', 'Binary Tree'],
  },
  'same-tree': {
    title: 'Same Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'symmetric-tree': {
    title: 'Symmetric Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'binary-tree-level-order-traversal': {
    title: 'Binary Tree Level Order Traversal',
    difficulty: 'Medium',
    topics: ['Tree', 'Breadth-First Search', 'Binary Tree'],
  },
  'binary-tree-zigzag-level-order-traversal': {
    title: 'Binary Tree Zigzag Level Order Traversal',
    difficulty: 'Medium',
    topics: ['Tree', 'Breadth-First Search', 'Binary Tree'],
  },
  'maximum-depth-of-binary-tree': {
    title: 'Maximum Depth of Binary Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'construct-binary-tree-from-preorder-and-inorder-traversal': {
    title: 'Construct Binary Tree from Preorder and Inorder Traversal',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'Divide and Conquer', 'Tree', 'Binary Tree'],
  },
  'construct-binary-tree-from-inorder-and-postorder-traversal': {
    title: 'Construct Binary Tree from Inorder and Postorder Traversal',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'Divide and Conquer', 'Tree', 'Binary Tree'],
  },
  'convert-sorted-array-to-binary-search-tree': {
    title: 'Convert Sorted Array to Binary Search Tree',
    difficulty: 'Easy',
    topics: ['Array', 'Divide and Conquer', 'Tree', 'Binary Search Tree', 'Binary Tree'],
  },
  'balanced-binary-tree': {
    title: 'Balanced Binary Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'minimum-depth-of-binary-tree': {
    title: 'Minimum Depth of Binary Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'path-sum': {
    title: 'Path Sum',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'path-sum-ii': {
    title: 'Path Sum II',
    difficulty: 'Medium',
    topics: ['Backtracking', 'Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'flatten-binary-tree-to-linked-list': {
    title: 'Flatten Binary Tree to Linked List',
    difficulty: 'Medium',
    topics: ['Linked List', 'Stack', 'Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'populating-next-right-pointers-in-each-node': {
    title: 'Populating Next Right Pointers in Each Node',
    difficulty: 'Medium',
    topics: ['Linked List', 'Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'pascals-triangle': { title: "Pascal's Triangle", difficulty: 'Easy', topics: ['Array', 'Dynamic Programming'] },
  'pascals-triangle-ii': {
    title: "Pascal's Triangle II",
    difficulty: 'Easy',
    topics: ['Array', 'Dynamic Programming'],
  },
  triangle: { title: 'Triangle', difficulty: 'Medium', topics: ['Array', 'Dynamic Programming'] },
  'best-time-to-buy-and-sell-stock': {
    title: 'Best Time to Buy and Sell Stock',
    difficulty: 'Easy',
    topics: ['Array', 'Dynamic Programming'],
  },
  'best-time-to-buy-and-sell-stock-ii': {
    title: 'Best Time to Buy and Sell Stock II',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming', 'Greedy'],
  },
  'best-time-to-buy-and-sell-stock-iii': {
    title: 'Best Time to Buy and Sell Stock III',
    difficulty: 'Hard',
    topics: ['Array', 'Dynamic Programming'],
  },
  'binary-tree-maximum-path-sum': {
    title: 'Binary Tree Maximum Path Sum',
    difficulty: 'Hard',
    topics: ['Dynamic Programming', 'Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'valid-palindrome': { title: 'Valid Palindrome', difficulty: 'Easy', topics: ['Two Pointers', 'String'] },
  'word-ladder': { title: 'Word Ladder', difficulty: 'Hard', topics: ['Hash Table', 'String', 'Breadth-First Search'] },
  'longest-consecutive-sequence': {
    title: 'Longest Consecutive Sequence',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'Union Find'],
  },
  'single-number': { title: 'Single Number', difficulty: 'Easy', topics: ['Array', 'Bit Manipulation'] },
  'single-number-ii': { title: 'Single Number II', difficulty: 'Medium', topics: ['Array', 'Bit Manipulation'] },
  'copy-list-with-random-pointer': {
    title: 'Copy List with Random Pointer',
    difficulty: 'Medium',
    topics: ['Hash Table', 'Linked List'],
  },
  'word-break': {
    title: 'Word Break',
    difficulty: 'Medium',
    topics: ['Array', 'Hash Table', 'String', 'Dynamic Programming', 'Trie', 'Memoization'],
  },
  'word-break-ii': {
    title: 'Word Break II',
    difficulty: 'Hard',
    topics: ['Array', 'Hash Table', 'String', 'Dynamic Programming', 'Backtracking', 'Trie', 'Memoization'],
  },
  'linked-list-cycle': {
    title: 'Linked List Cycle',
    difficulty: 'Easy',
    topics: ['Hash Table', 'Linked List', 'Two Pointers'],
  },
  'linked-list-cycle-ii': {
    title: 'Linked List Cycle II',
    difficulty: 'Medium',
    topics: ['Hash Table', 'Linked List', 'Two Pointers'],
  },
  'lru-cache': {
    title: 'LRU Cache',
    difficulty: 'Medium',
    topics: ['Hash Table', 'Linked List', 'Design', 'Doubly-Linked List'],
  },
  'min-stack': { title: 'Min Stack', difficulty: 'Medium', topics: ['Stack', 'Design'] },
  'intersection-of-two-linked-lists': {
    title: 'Intersection of Two Linked Lists',
    difficulty: 'Easy',
    topics: ['Hash Table', 'Linked List', 'Two Pointers'],
  },
  'majority-element': {
    title: 'Majority Element',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Table', 'Divide and Conquer', 'Sorting', 'Counting'],
  },
  'house-robber': { title: 'House Robber', difficulty: 'Medium', topics: ['Array', 'Dynamic Programming'] },
  'binary-search-tree-iterator': {
    title: 'Binary Search Tree Iterator',
    difficulty: 'Medium',
    topics: ['Stack', 'Tree', 'Design', 'Binary Search Tree', 'Binary Tree', 'Iterator'],
  },
  'number-of-islands': {
    title: 'Number of Islands',
    difficulty: 'Medium',
    topics: ['Array', 'Depth-First Search', 'Breadth-First Search', 'Union Find', 'Matrix'],
  },
  'reverse-linked-list': { title: 'Reverse Linked List', difficulty: 'Easy', topics: ['Linked List', 'Recursion'] },
  'course-schedule': {
    title: 'Course Schedule',
    difficulty: 'Medium',
    topics: ['Depth-First Search', 'Breadth-First Search', 'Graph', 'Topological Sort'],
  },
  'implement-trie-prefix-tree': {
    title: 'Implement Trie (Prefix Tree)',
    difficulty: 'Medium',
    topics: ['Hash Table', 'String', 'Design', 'Trie'],
  },
  'course-schedule-ii': {
    title: 'Course Schedule II',
    difficulty: 'Medium',
    topics: ['Depth-First Search', 'Breadth-First Search', 'Graph', 'Topological Sort'],
  },
  'kth-largest-element-in-an-array': {
    title: 'Kth Largest Element in an Array',
    difficulty: 'Medium',
    topics: ['Array', 'Divide and Conquer', 'Sorting', 'Heap (Priority Queue)', 'Quickselect'],
  },
  'invert-binary-tree': {
    title: 'Invert Binary Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Breadth-First Search', 'Binary Tree'],
  },
  'basic-calculator': {
    title: 'Basic Calculator',
    difficulty: 'Hard',
    topics: ['Math', 'String', 'Stack', 'Recursion'],
  },
  'kth-smallest-element-in-a-bst': {
    title: 'Kth Smallest Element in a BST',
    difficulty: 'Medium',
    topics: ['Tree', 'Depth-First Search', 'Binary Search Tree', 'Binary Tree'],
  },
  'power-of-two': { title: 'Power of Two', difficulty: 'Easy', topics: ['Math', 'Bit Manipulation', 'Recursion'] },
  'lowest-common-ancestor-of-a-binary-search-tree': {
    title: 'Lowest Common Ancestor of a Binary Search Tree',
    difficulty: 'Medium',
    topics: ['Tree', 'Depth-First Search', 'Binary Search Tree', 'Binary Tree'],
  },
  'lowest-common-ancestor-of-a-binary-tree': {
    title: 'Lowest Common Ancestor of a Binary Tree',
    difficulty: 'Medium',
    topics: ['Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'product-of-array-except-self': {
    title: 'Product of Array Except Self',
    difficulty: 'Medium',
    topics: ['Array', 'Prefix Sum'],
  },
  'sliding-window-maximum': {
    title: 'Sliding Window Maximum',
    difficulty: 'Hard',
    topics: ['Array', 'Queue', 'Sliding Window', 'Heap (Priority Queue)', 'Monotonic Queue'],
  },
  'search-a-2d-matrix-ii': {
    title: 'Search a 2D Matrix II',
    difficulty: 'Medium',
    topics: ['Array', 'Binary Search', 'Divide and Conquer', 'Matrix'],
  },
  'valid-anagram': { title: 'Valid Anagram', difficulty: 'Easy', topics: ['Hash Table', 'String', 'Sorting'] },
  'meeting-rooms': { title: 'Meeting Rooms', difficulty: 'Easy', topics: ['Array', 'Sorting'] },
  'meeting-rooms-ii': {
    title: 'Meeting Rooms II',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Greedy', 'Sorting', 'Heap (Priority Queue)'],
  },
  'graph-valid-tree': {
    title: 'Graph Valid Tree',
    difficulty: 'Medium',
    topics: ['Depth-First Search', 'Breadth-First Search', 'Union Find', 'Graph'],
  },
  'missing-number': {
    title: 'Missing Number',
    difficulty: 'Easy',
    topics: ['Array', 'Hash Table', 'Math', 'Binary Search', 'Bit Manipulation', 'Sorting'],
  },
  'alien-dictionary': {
    title: 'Alien Dictionary',
    difficulty: 'Hard',
    topics: ['Array', 'String', 'Depth-First Search', 'Breadth-First Search', 'Graph', 'Topological Sort'],
  },
  'encode-and-decode-strings': {
    title: 'Encode and Decode Strings',
    difficulty: 'Medium',
    topics: ['Array', 'String', 'Design'],
  },
  'find-the-duplicate-number': {
    title: 'Find the Duplicate Number',
    difficulty: 'Medium',
    topics: ['Array', 'Two Pointers', 'Binary Search', 'Bit Manipulation'],
  },
  'find-median-from-data-stream': {
    title: 'Find Median from Data Stream',
    difficulty: 'Hard',
    topics: ['Two Pointers', 'Design', 'Sorting', 'Heap (Priority Queue)', 'Data Stream'],
  },
  'coin-change': {
    title: 'Coin Change',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming', 'Breadth-First Search'],
  },
  'counting-bits': { title: 'Counting Bits', difficulty: 'Easy', topics: ['Dynamic Programming', 'Bit Manipulation'] },
  'top-k-frequent-elements': {
    title: 'Top K Frequent Elements',
    difficulty: 'Medium',
    topics: [
      'Array',
      'Hash Table',
      'Divide and Conquer',
      'Sorting',
      'Heap (Priority Queue)',
      'Bucket Sort',
      'Counting',
      'Quickselect',
    ],
  },
  'pacific-atlantic-water-flow': {
    title: 'Pacific Atlantic Water Flow',
    difficulty: 'Medium',
    topics: ['Array', 'Depth-First Search', 'Breadth-First Search', 'Matrix'],
  },
  'longest-repeating-character-replacement': {
    title: 'Longest Repeating Character Replacement',
    difficulty: 'Medium',
    topics: ['Hash Table', 'String', 'Sliding Window'],
  },
  'non-overlapping-intervals': {
    title: 'Non-overlapping Intervals',
    difficulty: 'Medium',
    topics: ['Array', 'Dynamic Programming', 'Greedy', 'Sorting'],
  },
  'diameter-of-binary-tree': {
    title: 'Diameter of Binary Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'Binary Tree'],
  },
  'subtree-of-another-tree': {
    title: 'Subtree of Another Tree',
    difficulty: 'Easy',
    topics: ['Tree', 'Depth-First Search', 'String Matching', 'Binary Tree', 'Hash Function'],
  },
  'palindromic-substrings': {
    title: 'Palindromic Substrings',
    difficulty: 'Medium',
    topics: ['Two Pointers', 'String', 'Dynamic Programming'],
  },
  'daily-temperatures': {
    title: 'Daily Temperatures',
    difficulty: 'Medium',
    topics: ['Array', 'Stack', 'Monotonic Stack'],
  },
  'network-delay-time': {
    title: 'Network Delay Time',
    difficulty: 'Medium',
    topics: ['Depth-First Search', 'Breadth-First Search', 'Graph', 'Heap (Priority Queue)', 'Shortest Path'],
  },
  'cheapest-flights-within-k-stops': {
    title: 'Cheapest Flights Within K Stops',
    difficulty: 'Medium',
    topics: [
      'Dynamic Programming',
      'Depth-First Search',
      'Breadth-First Search',
      'Graph',
      'Heap (Priority Queue)',
      'Shortest Path',
    ],
  },
  'binary-search': { title: 'Binary Search', difficulty: 'Easy', topics: ['Array', 'Binary Search'] },
};

/** Get metadata for a problem slug from built-in dictionary */
export function getPopularProblem(slug: string): PopularProblemMeta | undefined {
  if (!slug) return undefined;
  const normalized = slug.trim().toLowerCase();
  return POPULAR_PROBLEMS[normalized];
}
