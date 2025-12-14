

const args = process.argv;
const bencodedValue = args[3];

if (args[2] === "decode") {
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error(error.message);
    }
}

/**
 * Decodes a bencoded string into its corresponding JavaScript value.
 * Supported types: strings, integers, lists, and dictionaries.
 *
 * @param bencodedValue - The bencoded string to decode.
 * @returns The decoded value (string, number, array, or dict).
 */
function decodeBencode(bencodedValue: string): any {

    /**
     * Current index in the bencoded string being processed.
     */
    let index = 0;

    /**
     * Recursively decodes the bencoded string starting from the current index.
     * Updates the index as it consumes characters.
     *
     * @returns The decoded value for the current segment.
     */
    function decode(): any {
        const char = bencodedValue[index];

        // Handle Integers: i<number>e
        if (char === 'i') {
            index++; // skip 'i'
            const end = bencodedValue.indexOf('e', index);
            if (end === -1) {
                throw new Error('Invalid encoded value');
            }
            const num = parseInt(bencodedValue.substring(index, end));
            index = end + 1; // skip 'e'
            return num;
        }
        // Handle Lists: l<bencoded_elements>e
        else if (char === 'l') {
            index++; // skip 'l'
            const list: any[] = [];
            while (bencodedValue[index] !== 'e') {
                list.push(decode());
            }
            index++; // skip 'e'
            return list;
        }
        // Handle Dictionaries: d<key1><value1>...<keyN><valueN>e
        else if (char === 'd') {
            index++; // skip 'd'
            const dict: { [key: string]: any } = {};
            while (bencodedValue[index] !== 'e') {
                const key = decode();
                if (typeof key !== 'string') {
                    throw new Error('Dictionary keys must be strings');
                }
                const value = decode();
                dict[key] = value;
            }
            index++; // skip 'e'
            return dict;
        }
        // Handle Strings: <length>:<content>
        else if (!isNaN(parseInt(char))) {
            const colonIndex = bencodedValue.indexOf(':', index);
            if (colonIndex === -1) {
                throw new Error('Invalid encoded value');
            }
            const length = parseInt(bencodedValue.substring(index, colonIndex));
            index = colonIndex + 1;
            const str = bencodedValue.substring(index, index + length);
            index += length;
            return str;
        } else {
            throw new Error(`Invalid encoded value at index ${index}: ${char}`);
        }
    }

    return decode();
}
