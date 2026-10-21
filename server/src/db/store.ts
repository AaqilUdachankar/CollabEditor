import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export class JsonCollection<T extends { id?: string; _id?: string }> {
  private filePath: string;
  private cache: T[] | null = null;

  constructor(private name: string) {
    this.filePath = path.join(config.dbDir, `${name}.json`);
  }

  private load(): T[] {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.filePath)) {
      this.cache = [];
      return this.cache;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      this.cache = JSON.parse(data);
      return this.cache || [];
    } catch {
      this.cache = [];
      return this.cache;
    }
  }

  private save(): void {
    if (!fs.existsSync(config.dbDir)) {
      fs.mkdirSync(config.dbDir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.cache || [], null, 2), 'utf-8');
  }

  async find(query?: Partial<T> | ((item: T) => boolean)): Promise<T[]> {
    const all = this.load();
    if (!query) return [...all];
    if (typeof query === 'function') {
      return all.filter(query);
    }
    return all.filter(item => {
      for (const key of Object.keys(query)) {
        if ((item as any)[key] !== (query as any)[key]) return false;
      }
      return true;
    });
  }

  async findOne(query: Partial<T> | ((item: T) => boolean)): Promise<T | null> {
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }

  async findById(id: string): Promise<T | null> {
    const all = this.load();
    return all.find(item => item.id === id || item._id === id) || null;
  }

  async create(data: T): Promise<T> {
    const all = this.load();
    const doc = { ...data };
    if (!doc.id && !doc._id) {
      doc.id = Math.random().toString(36).substring(2, 11);
    }
    all.push(doc);
    this.save();
    return doc;
  }

  async findByIdAndUpdate(id: string, update: Partial<T>): Promise<T | null> {
    const all = this.load();
    const index = all.findIndex(item => item.id === id || item._id === id);
    if (index === -1) return null;
    all[index] = { ...all[index], ...update };
    this.save();
    return all[index];
  }

  async findByIdAndDelete(id: string): Promise<boolean> {
    const all = this.load();
    const filtered = all.filter(item => item.id !== id && item._id !== id);
    if (filtered.length !== all.length) {
      this.cache = filtered;
      this.save();
      return true;
    }
    return false;
  }

  async deleteMany(query: Partial<T>): Promise<number> {
    const all = this.load();
    const beforeCount = all.length;
    this.cache = all.filter(item => {
      for (const key of Object.keys(query)) {
        if ((item as any)[key] === (query as any)[key]) return false;
      }
      return true;
    });
    this.save();
    return beforeCount - this.cache.length;
  }
}
