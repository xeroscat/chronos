"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const timeMath_1 = require("../src/features/timeline/transformers/timeMath");
const cases = [
    {
        name: 'splits a midnight-spanning task into two independent intervals',
        run: () => (0, timeMath_1.getSlotsIntervals)(287, 2),
        expected: [
            { start: 287, end: 288 },
            { start: 0, end: 1 },
        ],
    },
    {
        name: 'detects a collision on the wrapped segment of a midnight-spanning task',
        run: () => (0, timeMath_1.checkCollision)(287, 2, [{ slotInicio: 0, duracionSlots: 1 }]),
        expected: true,
    },
    {
        name: 'does not report collision when blocks are adjacent',
        run: () => (0, timeMath_1.checkCollision)(0, 2, [{ slotInicio: 2, duracionSlots: 2 }]),
        expected: false,
    },
];
for (const testCase of cases) {
    const actual = testCase.run();
    assert_1.default.deepStrictEqual(actual, testCase.expected, testCase.name);
}
console.log('timeMath collision tests passed');
