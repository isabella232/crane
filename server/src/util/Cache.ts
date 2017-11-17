/**
 * Copyright (c) Hvy Industries. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 */
import { tmpdir } from 'os';
import * as fs from 'fs';
import * as path from 'path';

const caches:Object = {};

export default class Cache {
    filename: string;
    static TYPE_SHARD:string = 'shard';
    static TYPE_INDEX:string = 'index';

    constructor(filename: string) {
      this.filename = filename;
    }

    /**
     * Reads the cache entry
     */
    read(): any {
      if (fs.existsSync(this.filename)) {
        
      }
      return null;
    }

    /**
     * Writes a cache entry
     * @param data
     */
    write(data: any): void {

    }

    /**
     * Retrieves the cache instance (reader & writer)
     * @param type 
     * @param id 
     */
    static instance(type: string, id: string):Cache {
      let cacheFilename = path.join(
        tmpdir(), 'crane', type, name
      );
      if (!caches.hasOwnProperty(cacheFilename)) {
        caches[cacheFilename] = new Cache(cacheFilename);
      }
      return caches[cacheFilename];
    }
}
