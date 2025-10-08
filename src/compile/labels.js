export default {
  _count: 0,
  _labels: new Map(),

  new(text = "label", useCount = false) {
    const label = `.${useCount ? this._count++ + "_" : ""}${text}`;
    if (this._labels.has(label)) return this._labels.get(label);

    const value = {
      key: label,
      startLabel: `${label}_start`,
      endLabel: `${label}_end`,
    };

    this._labels.set(label, value);

    return value;
  },

  emit(label, atStart = false) {
    const result = [];

    // se já houver entradas no assembly, insere linha em branco antes da label
    if (!atStart && label.includes("_start")) {
      result.push({ type: "blank" });
    }
  
    result.push({ type: "label", text: label });
  
    if (label.includes("_end")) {
      result.push({ type: "blank" });
    }

    return result;
  },

  prettify(assembly) {
    const labelScopeStack = [];
    
    return assembly.map((entry, i) => {
      if (entry.type === "blank") {
        return ""; // linha em branco
      }

      if (entry.type === "label") {
        const popLabel = labelScopeStack.length > 0 && entry.text.includes("_end");
        if (popLabel) {
          // Pop all labels that start with the same index until one includes "_start"
          const [labelIndex] = entry.text.split("_");

          while (labelScopeStack.length > 0) {
            const lastLabel = labelScopeStack[labelScopeStack.length - 1];
            if (lastLabel.startsWith(labelIndex)) {
              labelScopeStack.pop();
              if (lastLabel.includes("_start")) break;
            } else {
              break;
            }
          }
        } else {
          labelScopeStack.push(entry.text); // abre novo bloco
        }

        const scope = "  ".repeat(labelScopeStack.length - (popLabel ? 0 : 1))
        return scope + entry.text;
      } else {
        const scope = "  ".repeat(labelScopeStack.length)
        const padded = scope + entry.text.padEnd(maxLen + 2);
        return entry.comment ? `${padded}; ${entry.comment}` : padded;
      }
    });
  }
}