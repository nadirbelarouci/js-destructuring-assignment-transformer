import ts = require("typescript");

const source = `
  function ping(arr){
      var b = arr[1];
      var c = arr[5],p = da,m = arr[9],p =arr[3];
      var d = zz[0];
      var x = zz[1];
      if(true){
        var d = ddd[0];
        var x = ddd[1];
      }
      
        var e = gg[0];
        var f = gg[1];
      const two = 2;
      const four = 4;
  }
`;

class ArrayBindingPatternInstance {
    bingingElements: Map<number, ts.BindingElement> = new Map();

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
        return true;
    }



}

class ArrayBindingPatternDeclarations {
    arrayBindingPatterns: Map<string, ArrayBindingPatternInstance> = new Map();

    add(variableDeclaration: ts.VariableDeclaration) {
        const initializer = variableDeclaration.initializer as ts.ElementAccessExpression;
        const array = initializer.expression.getText();

        if (this.arrayBindingPatterns.has(array)) {
            const arrayBindingElement = this.arrayBindingPatterns.get(array) as ArrayBindingPatternInstance;
             arrayBindingElement.addBindingElement(variableDeclaration);


        } else {

            this.arrayBindingPatterns.set(array, new ArrayBindingPatternInstance(variableDeclaration))
        }
    }


}

class ArrayBindingPatternTransformer {
    declarations: Map<ts.Block, ArrayBindingPatternDeclarations> = new Map();


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


console.log(result.outputText);
