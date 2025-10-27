import fs from "fs";
import path from "path";
import esprima, { Program } from "esprima";
import compile from "./compiler.js";

const ASSEMBLY_EXT = "as";
const BASE_ASSEMBLY_PATH = path.resolve("code-files/base.as");

const loadBaseAssembly = (): string[] => {
  if (fs.existsSync(BASE_ASSEMBLY_PATH)) {
    const content = fs.readFileSync(BASE_ASSEMBLY_PATH, "utf-8");
    return content.split(/\r?\n/);
  }
  return [];
};

const save = (code: string[], name: string) => {
  fs.writeFileSync(`./dist/${name}/${name}.${ASSEMBLY_EXT}`, code.join("\n"));
};

const debugLog = (code: string[]) => {
  const maxIndexSize = `${code.length}`.length;

  console.log("==> Assembly:\n");
  code.forEach((line, index) => {
    const indexSize = `${index}`.length;
    const padding = " ".repeat(maxIndexSize - indexSize);

    console.log(`${padding}${index}.  ${line}`);
  });
};

export default (code: string, name: string) => {
  const program: Program = esprima.parseScript(code);

  const baseAssembly = loadBaseAssembly();
  const compiledAssembly = compile(program);
  
  // Combine base assembly with compiled code
  const assembly: string[] = [...baseAssembly, "", ...compiledAssembly];

  save(assembly, name);
  debugLog(assembly);

  return assembly;
};
