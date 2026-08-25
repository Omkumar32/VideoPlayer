import mongoose from 'mongoose';
import crypto from 'crypto';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sultansusu09_db_user:JSiNDI63C99pAPZ9@cluster0.5sf5a3a.mongodb.net/secure_video_player?retryWrites=true&w=majority';

let cached = (global as any).mongoose;
if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Mongoose Schemas & Models

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  storageKey: { type: String, required: true },
  description: { type: String, default: '' },
  duration: { type: String, default: '03:15' },
  fileSize: { type: String, default: '18.5 MB' },
  createdBy: { type: String, default: 'admin@tridiagonal.com' },
}, { timestamps: true });

const VideoAccessSchema = new mongoose.Schema({
  videoId: { type: String, required: true },
  userEmail: { type: String, required: true, lowercase: true, trim: true },
  accessTokenHash: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired', 'revoked'], default: 'active' },
  maxViews: { type: Number, default: null },
  viewCount: { type: Number, default: 0 },
  registeredDeviceFingerprint: { type: String, default: null },
  registeredDeviceInfo: {
    userAgent: String,
    screenResolution: String,
    boundAt: String,
  },
  lastAccessedAt: { type: Date, default: null },
}, { timestamps: true });

const OTPSchema = new mongoose.Schema({
  accessRecordId: { type: String, required: true, index: true },
  userEmail: { type: String, required: true, lowercase: true },
  otpCode: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
}, { timestamps: true });

const AccessLogSchema = new mongoose.Schema({
  accessRecordId: { type: String, required: true },
  videoId: { type: String, required: true },
  userEmail: { type: String, required: true },
  event: { type: String, required: true },
  ipAddress: { type: String, default: '127.0.0.1' },
  userAgent: { type: String, default: '' },
  deviceFingerprint: { type: String, default: '' },
  details: { type: String, default: '' },
}, { timestamps: true });

export const VideoModel = mongoose.models.Video || mongoose.model('Video', VideoSchema);
export const VideoAccessModel = mongoose.models.VideoAccess || mongoose.model('VideoAccess', VideoAccessSchema);
export const OTPModel = mongoose.models.OTP || mongoose.model('OTP', OTPSchema);
export const AccessLogModel = mongoose.models.AccessLog || mongoose.model('AccessLog', AccessLogSchema);

// Memory fallback store for ultra-fast response if MongoDB connection has latency/DNS block
import fs from 'fs';
import path from 'path';

const DB_FILE_PATH = path.join(process.cwd(), 'data_store.json');

class Store {
  private getFileStore() {
    try {
      if (fs.existsSync(DB_FILE_PATH)) {
        return JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
      }
    } catch (e) {}
    return { videos: [], videoAccess: [], accessLogs: [], otps: [] };
  }

  // Dual MongoDB + Local Sync Methods
  public async getVideos() {
    const defaultSeedVideos = [
      {
        title: 'Tridiagonal Enterprise Platform Product Demo',
        storageKey: 'sample_product_training.mp4',
        description: 'Confidential product feature walkthrough and architectural overview for enterprise clients.',
        duration: '02:45',
        fileSize: '14.2 MB',
        createdBy: 'admin@tridiagonal.com',
      },
      {
        title: 'Q3 Executive Strategy & Financial Briefing',
        storageKey: 'executive_briefing.mp4',
        description: 'Strictly confidential roadmap and financial targets for authorized stakeholders only.',
        duration: '04:12',
        fileSize: '22.8 MB',
        createdBy: 'admin@tridiagonal.com',
      }
    ];

    try {
      await connectToDatabase();
      let docs = await VideoModel.find({}).sort({ createdAt: -1 }).lean();
      
      // Auto seed MongoDB Atlas if empty
      if (docs.length === 0) {
        await VideoModel.insertMany(defaultSeedVideos);
        docs = await VideoModel.find({}).sort({ createdAt: -1 }).lean();
      }

      if (docs.length > 0) {
        return docs.map((d: any) => ({ ...d, id: d._id.toString() }));
      }
    } catch (e) {
      console.warn('MongoDB query fallback to local store:', (e as any).message);
    }

    const local = this.getFileStore();
    if (local.videos.length === 0) {
      return defaultSeedVideos.map((v, i) => ({
        ...v,
        id: `vid_demo_0${i + 1}`,
        createdAt: new Date().toISOString(),
      }));
    }
    return local.videos;
  }

  public async getVideoById(id: string) {
    const videos = await this.getVideos();
    return videos.find((v: any) => v.id === id || (v as any)._id?.toString() === id);
  }

  public async addVideo(video: { title: string; description: string; storageKey: string; duration?: string; fileSize?: string; createdBy?: string }) {
    let mongoVideo = null;
    try {
      await connectToDatabase();
      const doc = await VideoModel.create(video);
      mongoVideo = { ...doc.toObject(), id: doc._id.toString() };
    } catch (e) {}

    const local = this.getFileStore();
    const newVideo = mongoVideo || {
      id: `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...video,
      createdAt: new Date().toISOString(),
    };
    local.videos.unshift(newVideo);
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));
    return newVideo;
  }

  public async getAllAccessRecords() {
    try {
      await connectToDatabase();
      const docs = await VideoAccessModel.find({}).sort({ createdAt: -1 }).lean();
      if (docs.length > 0) return docs.map(d => ({ ...d, id: (d as any)._id.toString() }));
    } catch (e) {}
    return this.getFileStore().videoAccess || [];
  }

  public async getAccessRecordByTokenHash(hash: string) {
    try {
      await connectToDatabase();
      const doc = await VideoAccessModel.findOne({ accessTokenHash: hash }).lean();
      if (doc) return { ...doc, id: (doc as any)._id.toString() };
    } catch (e) {}
    const local = this.getFileStore();
    return local.videoAccess.find((r: any) => r.accessTokenHash === hash);
  }

  public async getAccessRecordById(id: string) {
    try {
      await connectToDatabase();
      const doc = await VideoAccessModel.findById(id).lean();
      if (doc) return { ...doc, id: (doc as any)._id.toString() };
    } catch (e) {}
    const local = this.getFileStore();
    return local.videoAccess.find((r: any) => r.id === id);
  }

  public async createAccessRecord(params: { videoId: string; userEmail: string; expiresAt: string; maxViews?: number | null }) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const recordData = {
      videoId: params.videoId,
      userEmail: params.userEmail.toLowerCase().trim(),
      accessTokenHash: hash,
      expiresAt: new Date(params.expiresAt),
      status: 'active',
      maxViews: params.maxViews !== undefined ? params.maxViews : null,
      viewCount: 0,
      registeredDeviceFingerprint: null,
      registeredDeviceInfo: null,
      createdAt: new Date(),
      lastAccessedAt: null,
    };

    let mongoRecord = null;
    try {
      await connectToDatabase();
      const doc = await VideoAccessModel.create(recordData);
      mongoRecord = { ...doc.toObject(), id: doc._id.toString() };
    } catch (e) {}

    const local = this.getFileStore();
    const newRecord = mongoRecord || {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...recordData,
      expiresAt: params.expiresAt,
      createdAt: new Date().toISOString(),
    };
    local.videoAccess.unshift(newRecord);
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));

    return { record: newRecord, rawToken };
  }

  public async updateAccessRecord(id: string, updates: any) {
    try {
      await connectToDatabase();
      await VideoAccessModel.findByIdAndUpdate(id, updates);
    } catch (e) {}

    const local = this.getFileStore();
    const idx = local.videoAccess.findIndex((r: any) => r.id === id);
    if (idx !== -1) {
      local.videoAccess[idx] = { ...local.videoAccess[idx], ...updates };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));
    }
  }

  public async resetDeviceBinding(accessRecordId: string) {
    await this.updateAccessRecord(accessRecordId, {
      registeredDeviceFingerprint: null,
      registeredDeviceInfo: null,
    });
    return true;
  }

  public async createOTP(accessRecordId: string, userEmail: string) {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
      await connectToDatabase();
      await OTPModel.deleteMany({ accessRecordId });
      await OTPModel.create({
        accessRecordId,
        userEmail: userEmail.toLowerCase(),
        otpCode,
        expiresAt,
      });
    } catch (e) {}

    const local = this.getFileStore();
    local.otps = (local.otps || []).filter((o: any) => o.accessRecordId !== accessRecordId);
    local.otps.push({
      id: `otp_${Date.now()}`,
      accessRecordId,
      userEmail: userEmail.toLowerCase(),
      otpCode,
      expiresAt: expiresAt.getTime(),
      attempts: 0,
    });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));

    return otpCode;
  }

  public async verifyOTP(accessRecordId: string, inputCode: string) {
    try {
      await connectToDatabase();
      const otpDoc = await OTPModel.findOne({ accessRecordId });
      if (otpDoc) {
        if (new Date() > otpDoc.expiresAt) return { success: false, message: 'OTP expired.' };
        if (otpDoc.otpCode !== inputCode.trim()) return { success: false, message: 'Invalid code.' };
        await OTPModel.deleteOne({ _id: otpDoc._id });
        return { success: true, message: 'OTP verified.' };
      }
    } catch (e) {}

    const local = this.getFileStore();
    const rec = (local.otps || []).find((o: any) => o.accessRecordId === accessRecordId);
    if (!rec) return { success: false, message: 'No active OTP found.' };
    if (Date.now() > rec.expiresAt) return { success: false, message: 'OTP expired.' };
    if (rec.otpCode !== inputCode.trim()) return { success: false, message: 'Invalid code.' };

    local.otps = local.otps.filter((o: any) => o.accessRecordId !== accessRecordId);
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));
    return { success: true, message: 'OTP verified.' };
  }

  public async getLatestOTP(accessRecordId: string) {
    try {
      await connectToDatabase();
      const doc = await OTPModel.findOne({ accessRecordId }).sort({ createdAt: -1 }).lean() as any;
      if (doc) return doc.otpCode;
    } catch (e) {}

    const local = this.getFileStore();
    const item = (local.otps || []).find((o: any) => o.accessRecordId === accessRecordId);
    return item ? item.otpCode : null;
  }

  public async addLog(log: any) {
    try {
      await connectToDatabase();
      await AccessLogModel.create(log);
    } catch (e) {}

    const local = this.getFileStore();
    local.accessLogs = local.accessLogs || [];
    local.accessLogs.unshift({
      id: `log_${Date.now()}`,
      ...log,
      timestamp: new Date().toISOString(),
    });
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(local, null, 2));
  }

  public async getLogs(limit = 50) {
    try {
      await connectToDatabase();
      const docs = await AccessLogModel.find({}).sort({ createdAt: -1 }).limit(limit).lean();
      if (docs.length > 0) return docs;
    } catch (e) {}

    const local = this.getFileStore();
    return (local.accessLogs || []).slice(0, limit);
  }
}

export const dbStore = new Store();
