/*
 * Copyright © 2018, Octave Online LLC
 *
 * This file is part of Octave Online Server.
 *
 * Octave Online Server is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * Octave Online Server is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Octave Online Server.  If not, see
 * <https://www.gnu.org/licenses/>.
 */

"use strict";

const OnlineOffline = require("./online-offline");
const Queue = require("./queue");
const JSONStreamSafe = require("./json-stream-safe");

class StdioMessenger extends OnlineOffline {
	constructor() {
		super();

		// Message queue ("buffer") for outgoing messages
		this._messageQueue = new Queue();
		this._messageQueue.on("enqueue", this._flush.bind(this));

		this._readStream = null;
		this._writeStream = null;
	}

	setReadStream(stream) {
		if (this._readStream) throw new Error("Can set only one read stream");

		// TODO: Will the JSONStreamSafe ever be garbage collected?  The underlying stream will be closed when the session dies; is that sufficient?  Is it dangerous that the callback references "this"?
		this._readStream = new JSONStreamSafe(stream);
		this._readStream.on("data", this._handleData.bind(this));
		this._readStream.on("error", (err) => { this.emit("error", err); });
	}

	setWriteStream(stream) {
		if (this._writeStream) throw new Error("Can set only one write stream");

		this._writeStream = stream;
		this._flush();
	}

	sendMessage(name, content) {
		const message = JSON.stringify([name, content]);
		this._messageQueue.enqueue(message);
	}

	_flush() {
		if (!this._writeStream) return this._log.warn("Message stream unavailable");
		if (!this._writeStream.writable) return this._log.warn("Message stream not writable");

		while (!this._messageQueue.isEmpty()) {
			this._writeStream.write(this._messageQueue.dequeue());
		}
	}

	_handleData(data) {
		if (!Array.isArray(data) || data.length !== 2 || typeof data[0] !== "string") {
			return this.emit("error", new Error(`Malformed message: '${data}'`));
		}

		this.emit("message", data[0], data[1]);
		this.emit(`msg:${data[0]}`, data[1]);
	}
}

module.exports = StdioMessenger;
