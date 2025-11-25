

export default function assert(test: any): asserts test {
    if (!test) {
        throw new Error('Assertion failed');
    }
}