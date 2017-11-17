/**
 * Copyright (c) Hvy Industries. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * "HVY", "HVY Industries" and "Hvy Industries" are trading names of JCKD (UK) Ltd
 */

import Context from '../util/Context';
import { TokenType } from '../util/Context';

import App from '../app';
import IFinder from './IFinder';
import { CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { Class } from 'php-reflection';

/**
 * Defines the structure of the extension settings
 */
class Classes implements IFinder {
    protected app:App;

    /**
     * Initialize a new instance
     */
    constructor(app:App) {
        this.app = app;
    }

    /**
     * Checks if finder can match
     */
    matches(context:Context): boolean {
        if (context.current.type === TokenType.Keyword) {
            let keyword = context.current.text;
            return (keyword === 'extends' || keyword === 'new');
        }
        if (context.current.type === TokenType.Identifier) {
            let prev = context.current.previous();
            if (prev.text === 'new') {
              return true;
            }
        }
        return false;
    }

    /**
     * Finds a list of completion items
     */
    find(context:Context) : CompletionItem[] {
        let dataSource:Class[];
        if (context.current.type === TokenType.Identifier) {
          let classFQN:string = context.current.text;
          if (context.inNamespace()) {
            classFQN = context.scope.namespace.getFQN(classFQN);
          }
          dataSource = <Class[]>this.app.workspace.searchByName(
            'class', classFQN + '~', this.app.settings.maxSuggestionSize
          );
        } else if (context.inNamespace()) {
          dataSource = context.scope.namespace.getClasses();
        }

        // builds the response
        if (dataSource) {
          let result = [];
          for(let i = 0; i < dataSource.length; i++) {
            let insertText = dataSource[i].fullName;
            if (context.inNamespace()) {
              // check if the class is inside current namespace
              if (dataSource[i].getNamespace() === context.scope.namespace) {
                insertText = dataSource[i].name;
              } else {
                // check if class is defined into the `use` keyword
                let alias = context.scope.namespace.findAlias(dataSource[i].fullName);
                if (alias) {
                  insertText = alias;
                }
              }
            }
            let item:CompletionItem = {
              label: dataSource[i].name,
              kind: CompletionItemKind.Class,
              detail: dataSource[i].fullName,
              documentation: dataSource[i].doc ? dataSource[i].doc.summary : null,
              insertText: insertText
            };
            result.push(item);
            if (result.length === this.app.settings.maxSuggestionSize) {
              break;
            }
          }
          return result;
        }
        return null;
    }
}

// exports
export default Classes;
