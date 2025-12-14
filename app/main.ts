import * as fs from 'fs';
import * as crypto from 'crypto';
import { decodeBencode, encodeBencode } from './bencode';

const args = process.argv;
const command = args[2];

if (command === "decode") {
    const bencodedValue = args[3];
    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        console.error(error.message);
    }
} else if (command === "info") {
    const filename = args[3];
    try {
        const fileContent = fs.readFileSync(filename);
        const decoded = decodeBencode(fileContent.toString('binary'));

        console.log("Decoded torrent file content:");
        console.log(JSON.stringify(decoded, null, 2));

        const trackerUrl = decoded['announce'];
        const info = decoded['info'];
        const length = info['length'];

        const bencodedInfo = encodeBencode(info);
        const infoHash = crypto.createHash('sha1').update(bencodedInfo, 'binary').digest('hex');

        console.log(`Tracker URL: ${trackerUrl}`);
        console.log(`Length: ${length}`);
        console.log(`Info Hash: ${infoHash}`);
    } catch (error) {
        console.error(error.message);
    }
}
