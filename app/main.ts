import * as fs from 'fs';
import * as crypto from 'crypto';
import * as net from 'net';
import { decodeBencode, encodeBencode } from './bencode';

const args = process.argv;
const command = args[2];

if (command === "decode") {
    const bencodedValue = args[3];

    try {
        const decoded = decodeBencode(bencodedValue);
        console.log(JSON.stringify(decoded));
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
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
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
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
            const peerIp = [
                peersBinary.charCodeAt(i),
                peersBinary.charCodeAt(i + 1),
                peersBinary.charCodeAt(i + 2),
                peersBinary.charCodeAt(i + 3)
            ].join('.');
            const peerPort = (peersBinary.charCodeAt(i + 4) << 8) | peersBinary.charCodeAt(i + 5);
            console.log(`${peerIp}:${peerPort}`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
} else if (command === "handshake") {
    const filename = args[3];
    const peerAddress = args[4];
    const [peerIp, peerPort] = peerAddress.split(':');

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

        const protocolString = "BitTorrent protocol";
        const reservedBytes = Buffer.alloc(8);
        const peerId = crypto.randomBytes(20);

        const handshakeMessage = Buffer.concat([
            Buffer.from([protocolString.length]),
            Buffer.from(protocolString),
            reservedBytes,
            infoHashBuffer,
            peerId
        ] as any);

        const client = new net.Socket();
        client.connect(parseInt(peerPort), peerIp, () => {
            client.write(handshakeMessage as any);
        });

        let receivedData = Buffer.alloc(0);
        client.on('data', (data) => {
            receivedData = Buffer.concat([receivedData, data] as any);
            if (receivedData.length >= 68) {
                const receivedPeerId = receivedData.subarray(48, 68);
                console.log(`Peer ID: ${receivedPeerId.toString('hex')}`);
                client.end();
            }
        });

        client.on('error', (err) => {
            console.error(`Error: ${err.message}`);
        });

    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
} else if (command === "download_piece") {
    const outputPath = args[4];
    const torrentFilePath = args[5];
    const pieceIndex = parseInt(args[6]);

    try {
        const fileContent = fs.readFileSync(torrentFilePath);
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

        const peerIp = [
            peersBinary.charCodeAt(0),
            peersBinary.charCodeAt(1),
            peersBinary.charCodeAt(2),
            peersBinary.charCodeAt(3)
        ].join('.');
        const peerPort = (peersBinary.charCodeAt(4) << 8) | peersBinary.charCodeAt(5);

        const protocolString = "BitTorrent protocol";
        const reservedBytes = Buffer.alloc(8);

        const handshakeMessage = Buffer.concat([
            Buffer.from([protocolString.length]),
            Buffer.from(protocolString),
            reservedBytes,
            infoHashBuffer,
            Buffer.from(peerId)
        ] as any);

        const client = new net.Socket();
        client.connect(peerPort, peerIp, () => {
            client.write(handshakeMessage as any);
        });

        let receivedData = Buffer.alloc(0);
        let handshakeReceived = false;
        let bitfieldReceived = false;

        const totalLength = length;
        const numPieces = Math.ceil(totalLength / pieceLength);
        let currentPieceLength = pieceLength;
        if (pieceIndex === numPieces - 1) {
            const remainder = totalLength % pieceLength;
            if (remainder !== 0) currentPieceLength = remainder;
        }

        const BLOCK_SIZE = 16 * 1024;
        const totalBlocks = Math.ceil(currentPieceLength / BLOCK_SIZE);
        let downloadedBlocks = 0;
        const pieceBuffer = Buffer.alloc(currentPieceLength);
        let currentBlockIndex = 0;

        const requestBlock = () => {
            if (currentBlockIndex >= totalBlocks) return;

            const begin = currentBlockIndex * BLOCK_SIZE;
            let length = BLOCK_SIZE;
            if (currentBlockIndex === totalBlocks - 1) {
                length = currentPieceLength - begin;
            }

            const payload = Buffer.alloc(12);
            payload.writeUInt32BE(pieceIndex, 0);
            payload.writeUInt32BE(begin, 4);
            payload.writeUInt32BE(length, 8);

            const messageLen = Buffer.alloc(4);
            messageLen.writeUInt32BE(1 + 12, 0);

            const requestMsg = Buffer.concat([
                messageLen,
                Buffer.from([6]),
                payload
            ]);
            client.write(requestMsg);
            currentBlockIndex++;
        };

        client.on('data', (data) => {
            receivedData = Buffer.concat([receivedData, data]);

            if (!handshakeReceived) {
                if (receivedData.length >= 68) {
                    handshakeReceived = true;
                    receivedData = receivedData.subarray(68);
                } else {
                    return;
                }
            }

            while (receivedData.length >= 4) {
                const messageLength = receivedData.readUInt32BE(0);
                if (receivedData.length < 4 + messageLength) {
                    break;
                }

                const message = receivedData.subarray(0, 4 + messageLength);
                receivedData = receivedData.subarray(4 + messageLength);

                if (messageLength === 0) continue;

                const messageId = message[4];

                if (messageId === 5) {
                    bitfieldReceived = true;
                    const interested = Buffer.from([0, 0, 0, 1, 2]);
                    client.write(interested);
                } else if (messageId === 1) {
                    requestBlock();
                } else if (messageId === 7) {
                    const index = message.readUInt32BE(5);
                    const begin = message.readUInt32BE(9);
                    const block = message.subarray(13);

                    block.copy(pieceBuffer, begin);
                    downloadedBlocks++;

                    if (downloadedBlocks < totalBlocks) {
                        requestBlock();
                    } else {
                        client.end();
                        const pieceHash = crypto.createHash('sha1').update(pieceBuffer).digest('hex');
                        const expectedHash = pieces.substring(pieceIndex * 20, (pieceIndex + 1) * 20);
                        const expectedHashHex = Buffer.from(expectedHash, 'binary').toString('hex');

                        if (pieceHash === expectedHashHex) {
                            fs.writeFileSync(outputPath, pieceBuffer);
                            console.log(`Piece ${pieceIndex} downloaded to ${outputPath}.`);
                        } else {
                            console.error(`Piece hash mismatch. Expected ${expectedHashHex}, got ${pieceHash}`);
                        }
                    }
                }
            }
        });

        client.on('error', (err) => {
            console.error(`Error: ${err.message}`);
        });

    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
} else if (command === "download") {
    const outputPath = args[4];
    const torrentFilePath = args[5];

    try {
        const fileContent = fs.readFileSync(torrentFilePath);
        const decoded = decodeBencode(fileContent.toString('binary'));

        const trackerUrl = decoded['announce'];
        const info = decoded['info'];
        const length = info['length'];
        const pieceLength = info['piece length'];
        const pieces = info['pieces'];

        const bencodedInfo = encodeBencode(info);
        const infoHashBuffer = crypto.createHash('sha1').update(bencodedInfo, 'binary').digest();

        let infoHashEncoded = '';
        for (const byte of infoHashBuffer) {
            infoHashEncoded += '%' + byte.toString(16).padStart(2, '0');
        }

        const peerIdString = crypto.randomBytes(10).toString('hex');
        const queryParams = [
            `info_hash=${infoHashEncoded}`,
            `peer_id=${peerIdString}`,
            `port=6881`,
            `uploaded=0`,
            `downloaded=0`,
            `left=${length}`,
            `compact=1`
        ].join('&');

        const url = `${trackerUrl}?${queryParams}`;
        const response = await fetch(url);
        const responseBuffer = await response.arrayBuffer();
        const responseBody = Buffer.from(responseBuffer).toString('binary');
        const trackerResponse = decodeBencode(responseBody);

        const peersBinary = trackerResponse['peers'];
        const peers: { ip: string; port: number }[] = [];
        for (let i = 0; i < peersBinary.length; i += 6) {
            const ip = [
                peersBinary.charCodeAt(i),
                peersBinary.charCodeAt(i + 1),
                peersBinary.charCodeAt(i + 2),
                peersBinary.charCodeAt(i + 3)
            ].join('.');
            const port = (peersBinary.charCodeAt(i + 4) << 8) | peersBinary.charCodeAt(i + 5);
            peers.push({ ip, port });
        }

        const numPieces = Math.ceil(length / pieceLength);
        const pieceLengthFor = (index: number): number => {
            if (index === numPieces - 1) {
                const remainder = length % pieceLength;
                return remainder === 0 ? pieceLength : remainder;
            }
            return pieceLength;
        };

        // Work queue of piece indices that still need downloading.
        const workQueue: number[] = [];
        for (let i = 0; i < numPieces; i++) workQueue.push(i);

        const fileBuffer = Buffer.alloc(length);
        let completedPieces = 0;

        // Downloads a single piece from an already-handshaked, unchoked peer.
        const downloadPiece = (client: net.Socket, pieceIndex: number, leftover: Buffer): Promise<Buffer> => {
            return new Promise((resolve, reject) => {
                const currentPieceLength = pieceLengthFor(pieceIndex);
                const BLOCK_SIZE = 16 * 1024;
                const totalBlocks = Math.ceil(currentPieceLength / BLOCK_SIZE);
                const pieceBuffer = Buffer.alloc(currentPieceLength);
                let downloadedBlocks = 0;
                let receivedData = leftover;

                // Pipeline all block requests at once.
                for (let blockIndex = 0; blockIndex < totalBlocks; blockIndex++) {
                    const begin = blockIndex * BLOCK_SIZE;
                    const blockLength = Math.min(BLOCK_SIZE, currentPieceLength - begin);

                    const payload = Buffer.alloc(12);
                    payload.writeUInt32BE(pieceIndex, 0);
                    payload.writeUInt32BE(begin, 4);
                    payload.writeUInt32BE(blockLength, 8);

                    const messageLen = Buffer.alloc(4);
                    messageLen.writeUInt32BE(1 + 12, 0);

                    client.write(Buffer.concat([messageLen, Buffer.from([6]), payload] as any) as any);
                }

                const onData = (data: Buffer) => {
                    receivedData = Buffer.concat([receivedData, data] as any);

                    while (receivedData.length >= 4) {
                        const messageLength = receivedData.readUInt32BE(0);
                        if (receivedData.length < 4 + messageLength) break;

                        const message = receivedData.subarray(0, 4 + messageLength);
                        receivedData = receivedData.subarray(4 + messageLength);

                        if (messageLength === 0) continue;
                        const messageId = message[4];

                        if (messageId === 7) {
                            const begin = message.readUInt32BE(9);
                            const block = message.subarray(13);
                            block.copy(pieceBuffer, begin);
                            downloadedBlocks++;

                            if (downloadedBlocks === totalBlocks) {
                                client.removeListener('data', onData);
                                client.removeListener('error', onError);
                                resolve(pieceBuffer);
                                return;
                            }
                        }
                    }
                };

                const onError = (err: Error) => {
                    client.removeListener('data', onData);
                    client.removeListener('error', onError);
                    reject(err);
                };

                client.on('data', onData);
                client.on('error', onError);
            });
        };

        // A worker connects to a single peer, handshakes, then pulls pieces
        // off the work queue until it is empty.
        const worker = (peer: { ip: string; port: number }): Promise<void> => {
            return new Promise((resolve) => {
                const client = new net.Socket();
                let receivedData = Buffer.alloc(0);
                let handshakeDone = false;
                let ready = false;

                const protocolString = "BitTorrent protocol";
                const reservedBytes = Buffer.alloc(8);
                const peerIdBytes = crypto.randomBytes(20);
                const handshakeMessage = Buffer.concat([
                    Buffer.from([protocolString.length]),
                    Buffer.from(protocolString),
                    reservedBytes,
                    infoHashBuffer,
                    peerIdBytes
                ] as any);

                const cleanup = () => {
                    client.destroy();
                    resolve();
                };

                const processNextPiece = async () => {
                    while (workQueue.length > 0) {
                        const pieceIndex = workQueue.shift()!;
                        try {
                            const leftover = receivedData;
                            receivedData = Buffer.alloc(0);
                            const pieceBuffer = await downloadPiece(client, pieceIndex, leftover);

                            const pieceHash = crypto.createHash('sha1').update(pieceBuffer).digest('hex');
                            const expectedHash = pieces.substring(pieceIndex * 20, (pieceIndex + 1) * 20);
                            const expectedHashHex = Buffer.from(expectedHash, 'binary').toString('hex');

                            if (pieceHash !== expectedHashHex) {
                                // Re-queue the failed piece and abandon this peer.
                                workQueue.push(pieceIndex);
                                cleanup();
                                return;
                            }

                            pieceBuffer.copy(fileBuffer, pieceIndex * pieceLength);
                            completedPieces++;
                        } catch (err) {
                            // Network failure: re-queue and abandon this peer.
                            workQueue.push(pieceIndex);
                            cleanup();
                            return;
                        }
                    }
                    cleanup();
                };

                client.connect(peer.port, peer.ip, () => {
                    client.write(handshakeMessage as any);
                });

                const handshakeListener = (data: Buffer) => {
                    receivedData = Buffer.concat([receivedData, data] as any);

                    if (!handshakeDone && receivedData.length >= 68) {
                        handshakeDone = true;
                        receivedData = receivedData.subarray(68);
                    }
                    if (!handshakeDone) return;

                    // Process pre-download control messages (bitfield/unchoke).
                    while (!ready && receivedData.length >= 4) {
                        const messageLength = receivedData.readUInt32BE(0);
                        if (receivedData.length < 4 + messageLength) break;

                        const message = receivedData.subarray(0, 4 + messageLength);
                        receivedData = receivedData.subarray(4 + messageLength);

                        if (messageLength === 0) continue;
                        const messageId = message[4];

                        if (messageId === 5) {
                            // bitfield -> send interested
                            client.write(Buffer.from([0, 0, 0, 1, 2]) as any);
                        } else if (messageId === 1) {
                            // unchoke -> ready to download
                            ready = true;
                            client.removeListener('data', handshakeListener);
                            processNextPiece();
                        }
                    }
                };

                client.on('data', handshakeListener);
                client.on('error', () => cleanup());
            });
        };

        // Run workers across available peers concurrently.
        await Promise.all(peers.map(peer => worker(peer)));

        // Retry sequentially with the first peer if anything remains.
        while (workQueue.length > 0 && peers.length > 0) {
            const before = workQueue.length;
            await worker(peers[0]);
            if (workQueue.length === before) {
                throw new Error('Failed to download all pieces');
            }
        }

        if (completedPieces < numPieces) {
            throw new Error('Failed to download all pieces');
        }

        fs.writeFileSync(outputPath, fileBuffer);
        console.log(`Downloaded ${torrentFilePath} to ${outputPath}.`);
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error('An unexpected error occurred:', error);
        }
    }
}
