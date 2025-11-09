import { LabelType } from "../../types/compile";

const createLabel = (type: LabelType | string, id: string) => {
  const key = `.${type}${id}`;
  const labels: Record<string, LabelType | string> = {
    type,
    start: `${key}_start`,
    after: `${key}_after`,
  };

  switch (type) {
    case "while":
    case "doWhile":
    case "for":
    case "forIn":
    case "forOf":
      labels.body = `${key}_body`;
      labels.update = `${key}_update`;
      break;
    case "if":
      labels.else = `${key}_else`;
      break;
    case "switch":
      labels.case = `${key}_case`;
      break;
    case "try":
      labels.catch = `${key}_catch`;
      labels.finally = `${key}_finally`;
      break;
  }

  return labels;
};

export default function () {
  let labelCounter = 0;

  return (type: LabelType, unique = true) => {
    const suffix = unique ? `_${labelCounter++}` : "";

    return createLabel(type, suffix);
  };
}
