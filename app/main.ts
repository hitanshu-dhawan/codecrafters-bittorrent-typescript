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
        const name = info['name'];
        const pieceLength = info['piece length'];
        const pieces = info['pieces'];

        const bencodedInfo = encodeBencode(info);
        const infoHash = crypto.createHash('sha1').update(bencodedInfo, 'binary').digest('hex');

        console.log(`Tracker URL: ${trackerUrl}`);
        console.log(`Length: ${length}`);
        console.log(`Info Hash: ${infoHash}`);
        console.log(`Piece Length: ${pieceLength}`);
        console.log('Piece Hashes:');
        for (let i = 0; i < pieces.length; i += 20) {
            const piece = pieces.substring(i, i + 20);
            const pieceHash = Buffer.from(piece, 'binary').toString('hex');
            console.log(pieceHash);
        }
    } catch (error) {
        console.error(error.message);
    }
} else if (command === "peers") {
    const filename = args[3];
    try {
        const fileContent = fs.readFileSync(filename);
        const decoded = decodeBencode(fileContent.toString('binary'));

        console.log("Decoded torrent file content:");
        console.log(JSON.stringify(decoded, null, 2));

        const trackerUrl = decoded['announce'];
        const info = decoded['info'];
        const length = info['length'];
        const name = info['name'];
        const pieceLength = info['piece length'];
        const pieces = info['pieces'];

        const bencodedInfo = encodeBencode(info);
        const infoHashBuffer = crypto.createHash('sha1').update(bencodedInfo, 'binary').digest();

        let infoHashEncoded = '';
        for (const byte of infoHashBuffer) {
            infoHashEncoded += '%' + byte.toString(16).padStart(2, '0');
        }

        const peerId = crypto.randomBytes(10).toString('hex');
        const port = 6881;
        const uploaded = 0;
        const downloaded = 0;
        const left = length;
        const compact = 1;

        const queryParams = [
            `info_hash=${infoHashEncoded}`,
            `peer_id=${peerId}`,
            `port=${port}`,
            `uploaded=${uploaded}`,
            `downloaded=${downloaded}`,
            `left=${left}`,
            `compact=${compact}`
        ].join('&');

        const url = `${trackerUrl}?${queryParams}`;

        console.log(`Contacting tracker at: ${url}`);

        const response = await fetch(url);
        const responseBuffer = await response.arrayBuffer();
        const responseBody = Buffer.from(responseBuffer).toString('binary');

        const trackerResponse = decodeBencode(responseBody);

        console.log("Tracker response:");
        console.log(JSON.stringify(trackerResponse, null, 2));

        const peersBinary = trackerResponse['peers'];

        for (let i = 0; i < peersBinary.length; i += 6) {
            const ip = [
                peersBinary.charCodeAt(i),
                peersBinary.charCodeAt(i + 1),
                peersBinary.charCodeAt(i + 2),
                peersBinary.charCodeAt(i + 3)
            ].join('.');
            const port = (peersBinary.charCodeAt(i + 4) << 8) | peersBinary.charCodeAt(i + 5);
            console.log(`${ip}:${port}`);
        }
    } catch (error) {
        console.error(error.message);
    }
}
