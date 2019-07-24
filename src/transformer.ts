import ts = require("typescript");
import path = require("path");
import {readFileSync, writeFile} from "fs";

class ArrayBindingPatternInstance {
    bingingElements: Map<number, ts.BindingElement> = new Map();
    variableDeclarations: Map<number, ts.VariableDeclaration> = new Map();

    constructor(variableDeclaration: ts.VariableDeclaration) {
        this.addBindingElement(variableDeclaration)
    }

    addBindingElement(variableDeclaration: ts.VariableDeclaration) {
        const initializer = variableDeclaration.initializer as ts.ElementAccessExpression;
        const indexNode = initializer.argumentExpression as ts.NumericLiteral;
        const index = parseInt(indexNode.getText());

        if (this.bingingElements.has(index))
            return false;

        this.bingingElements.set(index, ts.createBindingElement(undefined, undefined, variableDeclaration.name));
        this.variableDeclarations.set(index, variableDeclaration);
        return true;
    }


    build(): ts.BindingElement[] {
        return [...this.bingingElements.keys()].sort()
            .map(i => this.bingingElements.get(i)) as ts.BindingElement[];

    }

    check(): ts.VariableDeclaration[] {
        const sortedKeys: number [] = [...this.bingingElements.keys()].sort();
        if (sortedKeys.length === 0)
            return [];

        for (let i = 0; i < sortedKeys.length; i++) {
            if (sortedKeys[i] != i) {
                const toDeleteKeys = sortedKeys.slice(i);
                toDeleteKeys.forEach(j => this.bingingElements.delete(j));
                return toDeleteKeys.map(j => this.variableDeclarations.get(j)) as ts.VariableDeclaration[];
            }
        }

        return []
    }
}

class ArrayBindingPatternDeclarations {
    arrayBindingPatterns: Map<string, ArrayBindingPatternInstance> = new Map();
    statementsToDelete: Map<ts.Node, string> = new Map();

    add(variableDeclaration: ts.VariableDeclaration) {
        const initializer = variableDeclaration.initializer as ts.ElementAccessExpression;
        const array = initializer.expression.getText();

        if (this.arrayBindingPatterns.has(array)) {
            const arrayBindingElement = this.arrayBindingPatterns.get(array) as ArrayBindingPatternInstance;
            const toDelete = arrayBindingElement.addBindingElement(variableDeclaration);
            if (toDelete)
                this.statementsToDelete.set(variableDeclaration, array);

        } else {
            this.statementsToDelete.set(variableDeclaration, array);

            this.arrayBindingPatterns.set(array, new ArrayBindingPatternInstance(variableDeclaration))
        }
    }


    build(array: string): ts.VariableDeclaration {
        const arrayBindingPattern = this.arrayBindingPatterns.get(array) as ArrayBindingPatternInstance;
        return ts.createVariableDeclaration(
            ts.createArrayBindingPattern(arrayBindingPattern.build()),
            undefined,
            ts.createIdentifier(array)
        );
    }

    check() {
        this.arrayBindingPatterns.forEach(elements => {
            const notValid = elements.check();
            notValid.forEach(element => this.statementsToDelete.delete(element));
        })
    }

}

class ArrayBindingPatternTransformer {
    declarations: Map<ts.Block, ArrayBindingPatternDeclarations> = new Map();


    check() {
        this.declarations.forEach(value => value.check())
    }

    transform<T extends ts.Node>(): ts.TransformerFactory<T> {
        const stack: ts.Block[] = [];
        const statementsToDelete: ts.Node[] = [];
        let started = false;
        return context => {
            const visit: ts.Visitor = node => {
                if (!started) {
                    started = true;
                    this.check();
                }
                if (ts.isBlock(node)) {
                    stack.push(node);
                }
                const children = ts.visitEachChild(node, child => visit(child), context);
                if (ts.isVariableDeclaration(node)) {
                    const currentBlock: ts.Block = stack[stack.length - 1];

                    const arrayBindingPatternDeclarations = this.declarations.get(currentBlock) as ArrayBindingPatternDeclarations;
                    if (arrayBindingPatternDeclarations.statementsToDelete.has(node)) {
                        const arrayName = arrayBindingPatternDeclarations.statementsToDelete.get(node) as string;
                        if (arrayBindingPatternDeclarations.arrayBindingPatterns.has(arrayName)) {

                            const result = arrayBindingPatternDeclarations.build(arrayName);
                            arrayBindingPatternDeclarations.arrayBindingPatterns.delete(arrayName);
                            return result;
                        }
                        statementsToDelete.push(node.parent);
                        return
                    }
                }
                if (node === statementsToDelete[statementsToDelete.length - 1]) {
                    statementsToDelete.pop();
                    if ((node as ts.VariableDeclarationList).declarations.length === 1) {
                        return ts.createEmptyStatement();
                    }
                }
                if (node === stack[stack.length - 1]) {
                    stack.pop();
                }
                return children;
            };

            return node => ts.visitNode(node, visit);
        };
    }

    initArrayBindingPatternDeclarations<T extends ts.Node>(): ts.TransformerFactory<T> {

        const stack: ts.Block[] = [];

        return context => {
            const visit: ts.Visitor = node => {
                if (ts.isBlock(node)) {
                    stack.push(node);
                    this.declarations.set(node, new ArrayBindingPatternDeclarations());
                }
                if (ts.isElementAccessExpression(node)) {
                    const currentBlock: ts.Block = stack[stack.length - 1];
                    const arrayBindingPatternDeclarations = this.declarations.get(currentBlock) as ArrayBindingPatternDeclarations;
                    arrayBindingPatternDeclarations.add(node.parent as ts.VariableDeclaration);

                }
                const children = ts.visitEachChild(node, child => visit(child), context);
                if (node === stack[stack.length - 1]) {
                    stack.pop();
                }
                return children;
            };

            return node => ts.visitNode(node, visit);
        };
    }


}

const fileName = process.argv[2];

const source = readFileSync(fileName).toString();

const arrayBindingPatternTransformer = new ArrayBindingPatternTransformer();

let result = ts.transpileModule(source, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2016},
    transformers: {
        before: [
            arrayBindingPatternTransformer.initArrayBindingPatternDeclarations(),
            arrayBindingPatternTransformer.transform()
        ]
    }
});


function save(code: string, fileName: string) {
    fileName = fileName.substring(0, fileName.lastIndexOf('.js')) + '-result.js';
    fileName = path.resolve(fileName);

    writeFile(fileName, code, (err) => {
        if (err) throw err;
        console.log('The file has been saved in ' + fileName);
    });

}

save(result.outputText, fileName);
