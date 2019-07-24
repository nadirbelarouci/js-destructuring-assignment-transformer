import ts = require("typescript");


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

function numberTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {
    return context => {
        const visit: ts.Visitor = node => {
            if (ts.isNumericLiteral(node)) {
                return ts.createStringLiteral(node.text);
            }
            return ts.visitEachChild(node, child => visit(child), context);
        };

        return node => ts.visitNode(node, visit);
    };
}

let result = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
    transformers: { before: [numberTransformer()] }
});

console.log(result.outputText);

/*
  var two = "2";
  var four = "4";
*/
