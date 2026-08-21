import { readFile, writeFile } from "node:fs/promises";

const files = [
  "client/src/index.css",
  "client/src/pages/Home.tsx",
  "client/src/components/ManusDialog.tsx",
];

const replacements = [
  ["#F2EADA", "#BFCED7"],
  ["#E9A329", "#686B6C"],
  ["#C63B32", "#000000"],
  ["#07543B", "#686B6C"],
  ["#244FA0", "#000000"],
  ["#f2eada", "#bfc ed7"],
  ["#e9a329", "#686b6c"],
  ["#c63b32", "#000000"],
  ["#07543b", "#686b6c"],
  ["#244fa0", "#000000"],
  ["rgba(242, 234, 218", "rgba(191, 206, 215"],
  ["rgba(233, 163, 41", "rgba(104, 107, 108"],
  ["rgba(198, 59, 50", "rgba(0, 0, 0"],
  ["rgba(7, 84, 59", "rgba(104, 107, 108"],
  ["rgba(36, 79, 160", "rgba(0, 0, 0"],
];

for (const file of files) {
  let content = await readFile(file, "utf8");
  for (const [from, to] of replacements) content = content.split(from).join(to);
  content = content.replaceAll("#bfc ed7", "#bfced7");
  await writeFile(file, content);
}
