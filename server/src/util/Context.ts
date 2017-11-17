/**
 * Copyright (c) Hvy Industries. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 */

import App from '../app';
import { File, Scope } from 'php-reflection';

const isIdentifier = function(ch: string): boolean {
  let ascii = ch.charCodeAt(0);
  return(
        (ascii > 96 && ascii < 123)
        || (ascii > 64 && ascii < 91)
        || ascii === 95
        || (ascii > 47 && ascii < 58)
        || ascii > 126
    );
};

const isSpace = function(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
};

const symbols = ';:,.\\[]()|^&+-/*=%!~<>?@';

/**
 * Non exhaustive list of keywords (just ones used)
 */
const keywords = [
  'class', 'extends', 'implements', 
  'function', 'new', 'trait', 'interface',
  'static', 'public', 'protected', 'private', 'abstract',
  'const', 'use', 'namespace', 'instanceof'
];

const isSymbol = function(ch: string): boolean {
  return symbols.indexOf(ch) !== -1;
};

const isNumber = function(ch: string): boolean {
  let ascii = ch.charCodeAt(0);
  return ascii > 47 && ascii < 58;
}

export enum TokenType {
  Identifier,
  Text,
  Keyword,
  Symbol,
  Variable,
  Comment,
  ObjectOperator,
  Assign,
  EOF
}

class Token {
  parent: Context;
  start: number;
  end: number;
  text: string;
  type: TokenType;
  private prevToken: Token;
  private nextToken: Token;

  /**
   * Initialize a new token
   * @param parent
   * @param type 
   * @param previous 
   * @param next 
   */
  constructor(parent:Context, type: TokenType, start: number, end: number, previous?: Token, next?: Token) {
    this.parent = parent;
    this.type = type;
    this.prevToken = previous;
    this.nextToken = next;
    this.start = start;
    this.end = end;
    if (start < end) {
      this.text = parent.text.substring(start, end);
    }
  }

  /**
   * Gets the next token
   */
  next(): Token {
    if (this.type === TokenType.EOF) {
      return this;
    }
    if (!this.nextToken) {
      this.nextToken = Token.parse(
        this.parent, this.end + 1, this
      );
    }
    return this.nextToken;
  }

  /**
   * Gets the previous token
   */
  previous(): Token {
    if (!this.prevToken) {
      let nextStart = Token.findStart(this.parent, this.start - 1);
      this.prevToken = Token.parse(
        this.parent, nextStart, null, this
      );
    }
    return this.prevToken;
  }

  static parse(ctx: Context, offset: number, previous?: Token, next?: Token): Token {
    let max = ctx.text.length;
    if (isSpace(ctx.text[offset])) {
      let i:number;
      for(i = offset; i < max; i--) {
        let ch = ctx.text[i];
        if (!isSpace(ch)) {
          offset = i;
          break;
        }
      }
      if (i === max) {
        return new Token(ctx, TokenType.EOF, offset, offset, previous);
      }
    }

    let ch = ctx.text[offset];

    if (ch === '/') {
      let i = offset + 1;
      ch = ctx.text[i];
      if (ch === '/') {
        while(++i < ctx.text.length) {
          ch = ctx.text[i];
          if (ch === '\r' || ch === '\n') {
            break;
          }
        }
        return new Token(ctx, TokenType.Comment, offset, i, previous, next);
      } else if (ch === '*') {
        while(++i < ctx.text.length) {
          ch = ctx.text[i];
          if (ch === '*') {
            ch = ctx.text[++i];
            if (ch === '/') break;
          }
        }
        return new Token(ctx, TokenType.Comment, offset, i, previous, next);
      } else {
        return new Token(ctx, TokenType.Symbol, offset, i, previous, next);
      }
    } else if (ch === '#') {
      let i = offset;
      while(++i < ctx.text.length) {
        ch = ctx.text[i];
        if (ch === '\r' || ch === '\n') {
          break;
        }
      }
      return new Token(ctx, TokenType.Comment, offset, i, previous, next);
    } else if (ch === '"') {
      let i = offset;
      while(++i < ctx.text.length) {
        ch = ctx.text[i];
        if (ch === '\\') continue;
        if (ch === '"') break;
      }
      return new Token(ctx, TokenType.Text, offset, i, previous, next);
    } else if (ch === '\'') {
      let i = offset;
      while(++i < ctx.text.length) {
        ch = ctx.text[i];
        if (ch === '\\') continue;
        if (ch === '\'') break;
      }
      return new Token(ctx, TokenType.Text, offset, i, previous, next);
    } else if (ch === '-') {
      if (ctx.text[offset + 1] === '>') {
        return new Token(ctx, TokenType.ObjectOperator, offset, offset + 2, previous, next);
      }
      return new Token(ctx, TokenType.Symbol, offset, offset + 1, previous, next);
    } else if (ch === ':') {
      if (ctx.text[offset + 1] === ':') {
        return new Token(ctx, TokenType.ObjectOperator, offset, offset + 2, previous, next);
      }
      return new Token(ctx, TokenType.Symbol, offset, offset + 1, previous, next);
    } else if (ch === '$') {
      let i = offset;
      while(++i < ctx.text.length) {
        ch = ctx.text[i];
        if (!isIdentifier(ch)) {
          break;
        }
      }
      return new Token(ctx, TokenType.Variable, offset, i, previous, next);
    } else if (isIdentifier(ch)) {
      let i = offset;
      while(++i < ctx.text.length) {
        ch = ctx.text[i];
        if (!isIdentifier(ch)) {
          break;
        }
      }
      var id = ctx.text.substring(offset, i).toLowerCase();
      if (keywords.indexOf(id) > -1) {
        return new Token(ctx, TokenType.Keyword, offset, i, previous, next);
      } else {
        return new Token(ctx, TokenType.Identifier, offset, i, previous, next);
      }
    } else if (ch === '=') {
      let i = offset + 1;
      ch = ctx.text[i];
      if (ch === '>') {
        // array assign : [ 'a' => 1 ]
        return new Token(ctx, TokenType.Assign, offset, i + 1, previous, next);
      } else if (ch !== '=')  {
        return new Token(ctx, TokenType.Assign, offset, i, previous, next);
      }
    }

    return new Token(ctx, TokenType.Symbol, offset, offset + 1, previous, next);
  }

  /**
   * Lookup for the previous starting offset
   * @param ctx
   * @param offset 
   */
  static findStart(ctx: Context, offset: number): number {
    if (isSpace(ctx.text[offset])) {
      let i:number;
      for(i = offset - 1; i > 0; i--) {
        let ch = ctx.text[i];
        if (!isSpace(ch)) {
          offset = i;
          break;
        }
      }
      if (i === 0) {
        return 0;
      }
    }
    let waitSymbol = isSymbol(ctx.text[offset]);
    for(let i = offset - 1; i > 0; i--) {
      let ch = ctx.text[i];
      if (waitSymbol) {
        if (!isSymbol(ch)) return i + 1;
      } else {
        if (isSpace(ch)) return i + 1;
        if (isSymbol(ch)) return i + 1;
      }
    }
    return 0;
  }
}

/**
 * With a context resolves everything
 */
export default class Context {
    public char:string;
    public current:Token;
    public text:string;
    public scope:Scope;
    public offset:number;
    public file:File;

    /**
     * Retrieves current state from the specified offset
     */
    constructor(text: string, offset: number) {
        this.text = text;
        this.offset = offset;
        this.char = text[offset];
        this.current = Token.parse(this, Token.findStart(this, offset));
    }

    /**
     * Checks if is in a namespace context
     */
    inNamespace(): boolean {
        return this.scope.namespace !== null;
    }

    /**
     * Checks if is in a class/trait context
     */
    inClassOrTrait(): boolean {
        return this.scope.class !== null || this.scope.trait !== null;
    }

    /**
     * Checks if is in a method context
     */
    inMethod(): boolean {
        return this.inClassOrTrait() && this.scope.method !== null;
    }

    /**
     * Resolves the current context
     */
    resolve(app:App, filename:string, offset:number): Promise<void> {
        return new Promise((done, reject) => {
            app.message.trace(
                'Autocomplete from ' + offset + ' @ "' + this.char + '" / ' + this.current.text
            );
            
            // search the file
            let file = app.workspace.getFile(filename);
            if (!file) {
                return app.workspace.sync(
                    filename, this.text
                ).then((file: File) => {
                    this.scope = file.getScope(offset);
                    this.file = file;
                    done();
                });
            }
            this.scope = file.getScope(offset);
            this.file = file;
            done();
        });
    }
}
