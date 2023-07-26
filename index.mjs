import axios from 'axios';
import fs from 'fs';
import path from 'path';
import https from 'https';
import FormData from 'form-data';
import { createHash } from 'crypto';

export class DataBatch {
    constructor(server, collector, appKey, name) {
        this.server = server;
        this.collector = collector;
        this.appKey = appKey;
        this.name = name;
        this.queue = [];
        this.interval;
    }

    async init(options) {
        if (this.server.startsWith('https') && options?.allowUnauthorizedHttps) {
            this.serverOptions = { httpsAgent: new https.Agent({ rejectUnauthorized: false }) };
        }

        // register new version
        let response = await this.postServer('/api/storage/versions', { name: this.name });

        // then initialize batch
        this.version = response.data.version;
        this.timeout = response.data.timeout * 1000; // response timeout in s
        this.stop();
        this.interval = setInterval(() => this.heartbeat(), this.timeout / 5);
        this.lat = Date.now();
    }

    async heartbeat() {
        if (Date.now() - this.lat >= 2 * this.timeout / 5) {
            await this.postServer(`/api/storage/versions/${this.version}/heartbeat`);
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async add(type, json) {
        this.queue.push({ type, json });

        if (this.queue.length >= (this.options?.buffer || 100)) {
            await this.flush();
        }
    }

    async flush() {
        if (this.queue.length > 0) {
            let instances = [];
            let files = [];

            // handle files one by one, and accumulate instances
            for (let i of this.queue) {
                let inst = await handleFiles(i.json);
                instances.push({ type: i.type, body: inst.body, files: inst.files.map(i => i.key) });
                inst.files.forEach(i => files.push(i));
            }

            // prepare files at first
            let findResponse = await this.postServer(`/api/file/find`, files.map(i => i.key));
            let fileMap = new Set();
            findResponse.data.forEach(i => fileMap.add(i));
            let uploadFiles = files.filter(i => !fileMap.has(i.key));
            for (let i of uploadFiles) {
                var formData = new FormData();
                formData.append('file', fs.createReadStream(i.file), i.key);
                let response = await this.postServer('/api/file/files', formData, { headers: formData.getHeaders() });

                // We shall assert equaity of our own name and server's result
                if (response.data.fileName != i.key) {
                    throw new Error('Inconsist File Upload');
                }
            }

            // then add the instance
            let response = await this.postServer(`/api/storage/versions/${this.version}/instances`, instances);

            // reset queue at last
            this.queue = [];
        }
    }

    async complete() {
        await this.flush();
        await this.postServer(`/api/storage/versions/${this.version}/complete`);
        this.stop();
    }

    async cancel() {
        await this.postServer(`/api/storage/versions/${this.version}/cancel`);
        this.stop();
    }

    async postServer(url, data, options) {
        try {
            let result = await axios.post(this.server + url, data || {}, { headers: { collector: this.collector, appkey: this.appKey, ...options?.headers }, ...this.serverOptions });
            this.lat = Date.now(); // update lat when any request success
            return result;
        }
        catch (e) {
            let message = e.response?.data?.message;
            if (message) {
                let err = new Error(message);
                err.status = e.response.status;
                throw err;
            }
            else {
                throw e; // simply throw original error
            }
        }
    }
}

export class FileField {
    constructor(path) {
        this.path = path;
    }
}

function asyncReadFile(path) {
    return new Promise((resolve, reject) => fs.readFile(path, null, (err, data) => {
        if (err) {
            reject(err);
        }
        else {
            resolve(data);
        }
    }));
}

// return { file, key }
async function getFile(fileField) {
    let fileName = fileField.path;
    let data = await asyncReadFile(fileName);
    let ext = path.extname(fileName);
    let hex = createHash('sha256').update(data).update(ext).digest('hex');
    return { file: fileName, key: hex + ext };
}

async function handleFiles(json) {
    let files = [];
    async function traverseObject(obj) {
        switch (typeof (obj)) {
            case 'object':
                if (obj instanceof Array) {
                    let ret = [];
                    for (let i of obj) {
                        ret.push(await traverseObject(i));
                    }
                    return ret;
                }
                else {
                    let ret = {};
                    for (let i in obj) {
                        let val = obj[i];
                        if (val instanceof FileField) {
                            let file = await getFile(val);
                            files.push(file);
                            val = file.key;
                        }
                        else {
                            val = await traverseObject(val);
                        }
                        ret[i] = val;
                    }
                    return ret;
                }
            default:
                return obj;
        }
    }

    let body = await traverseObject(json);
    return { body, files };
}