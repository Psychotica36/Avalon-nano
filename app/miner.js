var Miner = function() {
	// Events
	this.onNewNano = new MinerEvent();
	this.onNanoDeleted = new MinerEvent();
	this.onNanoConnected = new MinerEvent();
	this.onNanoDetected = new MinerEvent();
	this.onNewNonce = new MinerEvent();
	this.onNewStatus = new MinerEvent();
	this._JOB_BUFFER_SIZE = 256;
	this._WORK_BUFFER_SIZE = 1024;

	this._jobId = 0;
	this._poolId = 0;

	this._jobs = [];
	this._works = [];

	this._nanos = [];
	this._pools = [];

	var miner = this;

	this.scanNano();
	chrome.hid.onDeviceAdded.addListener(function(device) {
		miner.newNano = {
			nano: new Nano(device, miner),
			nanoId: device.deviceId
		};
	});
	chrome.hid.onDeviceRemoved.addListener(function(deviceId) {
		miner.nanoDeleted = deviceId;
	});

	chrome.sockets.tcp.onReceive.addListener(function(info) {
		for (pool of miner._pools)
			if (info.socketId === pool.socketId) {
				pool.download(info);
				return
			}
	});

	this._thread = new Worker("thread.js");
	this._thread.onmessage = function(work) {
		//console.log("[Miner] New Work:");
		miner._works.push(work.data);
		if (miner._works.length >= miner._WORK_BUFFER_SIZE) {
			miner._thread.postMessage("pause");
			miner._thread_pause = true;
		}
	};
};

Miner.prototype.__defineSetter__("newJob", function(job) {
	this._jobId = (this._jobId + 1) % this._JOB_BUFFER_SIZE;
	this._jobs[this._jobId] = job;
	
	// clear work buffer
	this._works = [];
	this._thread_pause = false;

	//console.log("[Miner] New Job:");
	this._thread.postMessage({job: job, jobId: this._jobId});
});

Miner.prototype.__defineSetter__("newNano", function(info) {
	// info: {nanoId, nano}
	this.log("info", "New Nano: %d", info.nanoId);
	this._nanos[info.nanoId] = info.nano;
	info.nano.connect();

	this.onNewNano.fire(info);
});

Miner.prototype.__defineSetter__("nanoDeleted", function(nanoId) {
	this.log("info", "Nano Deleted: %d", nanoId);
	this._nanos[nanoId].stop();
	delete(this._nanos[nanoId]);
	this.onNanoDeleted.fire(nanoId);
});

Miner.prototype.__defineSetter__("nanoConnected", function(info) {
	// info: {nanoId, success}
	if (info.success)
		this._nanos[info.nanoId].detect();
	this.onNanoConnected.fire(info);
});

Miner.prototype.__defineSetter__("nanoDetected", function(info) {
	// info: {nanoId, success}
	if (info.success)
		this._nanos[info.nanoId].run(4);
	this.onNanoConnected.fire(info);
});

Miner.prototype.__defineSetter__("newNonce", function(info) {
	// info: {nanoId, nonce}
	// TODO: submit
	this.onNewNonce.fire(info);
});

Miner.prototype.__defineSetter__("newStatus", function(info) {
	// info: {nanoId, stat}
	// TODO: update status
	this.onNewStatus.fire(info);
});

Miner.prototype.__defineGetter__("getWork", function() {
	var work = this._works.shift();
	if (this._thread_pause && (this._works.length < this._WORK_BUFFER_SIZE - 10)) {
		this._thread.postMessage("resume");
		this._thread_pause = false;
	}
	return work;
});

Miner.prototype.setPool = function(poolInfo, poolId) {
	if (this._pools[poolId] !== undefined)
		this._pools[poolId].disconnect();
	poolInfo.id = poolId;
	this._pools[poolId] = new Pool(poolInfo, this);
	this._pools[poolId].run();
};

Miner.prototype.scanNano = function() {
	var miner = this;
	chrome.hid.getDevices(FILTERS, function(devices) {
		if (chrome.runtime.lastError) {
			console.error(chrome.runtime.lastError.message);
			return;
		}
		for (var device of devices) {
			miner.newNano = {
				nano: new Nano(device, miner),
				nanoId: device.deviceId
			};
		}
	});
};

Miner.prototype.log = function(level) {
	var args = Array.prototype.slice.call(arguments);
    args.shift();
	switch (level) {
		case "error":
			args[0] = "[MINER] " + arguments[1];
			console.error.apply(console, args);
			break;
		case "warn":
			args[0] = "[MINER] " + arguments[1];
			console.warn.apply(console, args);
			break;
		case "info":
			args[0] = "[MINER] " + arguments[1];
			console.info.apply(console, args);
			break;
		case "log1":
			args.unshift("%c[MINER] " + arguments[1]);
			args[1] = MINER_LOG1_STYLE;
			console.log.apply(console, args);
			break;
		case "log2":
			args.unshift("%c[MINER] " + arguments[1]);
			args[1] = MINER_LOG2_STYLE;
			console.log.apply(console, args);
			break;
		case "debug":
			args.unshift("%c[MINER] " + arguments[1]);
			args[1] = MINER_DEBUG_STYLE;
			console.debug.apply(console, args);
			break;
		default:
			break;
	}
};

var MinerEvent = function() {
	this._registered = [];
};

MinerEvent.prototype.addListener = function(callback) {
	return this._registered.push(callback) - 1;
};

MinerEvent.prototype.removeListener = function(id) {
	delete(this._registered[id]);
};

MinerEvent.prototype.fire = function(info) {
	for (var callback of this._registered)
		if (callback !== undefined)
			callback(info);
};
