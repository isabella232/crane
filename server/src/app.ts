/*!
 * Copyright (c) Hvy Industries. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 */

import events = require('events');
import ISettings from './options/ISettings';
import Settings from './options/Settings';
import Message from './util/Message';
import Cache from './util/Cache';
import { Repository, Options } from 'php-reflection';
import { shard, index } from 'grafine';


/**
 * The main application instance
 */
class App extends events.EventEmitter {
    /**
     * The application settings instance
     */
    settings: ISettings;

    /**
     * The reflection engine
     */
    workspace: Repository;

    /**
     * The messaging object
     */
    message: Message;

    /**
     * Defines the custom autocomplete handler
     */
    autocomplete: Function;

    /**
     * Current working directory
     */
    path: string;

    /**
     * The caching flushing timer
     */
    private cacheFlush:NodeJS.Timer;

    /**
     * Initialize the workspace
     */
    constructor(path: string, settings: any = null) {
        super();
        this.setPath(path);
        this.setSettings(settings || new Settings());
    }

    /**
     * Make an absolute path relative to current root repository
     */
    resolveUri(uri:string): string {
        let filename:string = uri;
        if (filename.substring(0, 7) === 'file://') {
            filename = filename.substring(7);
        }
        if (filename.startsWith(this.path)) {
            filename = filename.substring(this.path.length);
            if (filename[0] === '/') {
                filename = filename.substring(1);
            }
        }
        return filename;
    }

    /**
     * Changing the current path
     */
    setPath(path: string) {
        this.path = path;
        if (this.settings) {
            // rebuilds the workspace
            this.setSettings(this.settings);
        }
    }

    /**
     * Update settings
     */
    setSettings(settings: ISettings) {
        // init settings
        this.settings = settings;
        if (this.cacheFlush) {
          clearInterval(this.cacheFlush);
        }

        // bind parameters
        let opt:Options = {
            // @todo : bind parameters
            debug: this.settings.debugMode,
            include: this.settings.include,
            exclude: this.settings.exclude,
            ext: this.settings.extensions,
            encoding: this.settings.encoding,
            cacheByFileHash: false,
            cacheByFileDate: false,
            cacheByFileSize: false,
            // force disable worker for now
            forkWorker: false,
            scanVars: this.settings.scanVars,
            scanExpr: this.settings.scanExpr,
            scanDocs: true,
        };

        // enabling the cache system
        if (this.settings.enableCache) {
            opt.cacheByFileHash = this.settings.cacheByFileHash;
            opt.cacheByFileDate = this.settings.cacheByFileDate;
            opt.cacheByFileSize = this.settings.cacheByFileSize;
            opt.lazyCache = function(type: string, name: string) {
                return Cache.instance(type, name).read();
            };
        }

        // initialize the reflection repository
        this.workspace = new Repository(this.path, opt);

        // start the async cache synchronisation if caching is enabled
        if (this.settings.enableCache) {
          this.cacheFlush = setInterval(() => {
            // flushing each shard
            this.workspace.db.shards().forEach((shard: shard) => {
              if (shard.isChanged()) {
                Cache.instance(Cache.TYPE_SHARD, shard.id().toString()).write(
                  shard.export()
                );
              }
            });
            // flushing each index
            this.workspace.db.indexes().forEach((index: index) => {
              if (index.isChanged()) {
                Cache.instance(Cache.TYPE_INDEX, index.id().toString()).write(
                  index.export()
                );
              }
            });
          }, 10000);
        }

        // forward events :
        this.workspace.on('read', this.emit.bind(this, ['read']));
        this.workspace.on('cache', this.emit.bind(this, ['cache']));
        this.workspace.on('parse', this.emit.bind(this, ['parse']));
        this.workspace.on('error', this.emit.bind(this, ['error']));
        this.workspace.on('progress', this.emit.bind(this, ['progress']));
    }
}

export default App;
