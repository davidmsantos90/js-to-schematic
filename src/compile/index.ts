import fs from "fs";
import esprima, { Program } from "esprima";
import compile from "./functionalCompiler.js";

const ASSEMBLY_EXT = "as";

const save = (code: string[], name: string) => {
  fs.writeFileSync(`./dist/${name}/${name}.${ASSEMBLY_EXT}`, code.join("\n"));
};

const debugLog = (code: string[]) => {
  const maxIndexSize = `${code.length}`.length;

  console.log("\n\n==> Assembly:\n");
  code.forEach((line, index) => {
    const indexSize = `${index + 1}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    console.log(`${padding}${index + 1}.  ${line}`);
  });
};

export default (code: string, name: string) => {
  const program: Program = esprima.parseScript(code);

  const assembly: string[] = compile(program);

  save(assembly, name);
  debugLog(assembly);

  return assembly;
};
