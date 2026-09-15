import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseJsonTree,
  formatJsonProperty,
  getJsonNodeValueText,
  parseXml,
  formatXmlNode,
  getXmlNodeContent,
} from "../lib/logic/format.ts";

test("json-tree: parse primitive values", () => {
  const numTree = parseJsonTree("42");
  assert.ok(numTree && numTree.kind === "primitive");
  assert.equal(numTree.value, 42);
  assert.equal(getJsonNodeValueText(numTree), "42");

  const strTree = parseJsonTree('"hello"');
  assert.ok(strTree && strTree.kind === "primitive");
  assert.equal(strTree.value, "hello");
  assert.equal(getJsonNodeValueText(strTree), "hello");

  const boolTree = parseJsonTree("true");
  assert.ok(boolTree && boolTree.kind === "primitive");
  assert.equal(boolTree.value, true);
  assert.equal(getJsonNodeValueText(boolTree), "true");

  const nullTree = parseJsonTree("null");
  assert.ok(nullTree && nullTree.kind === "primitive");
  assert.equal(nullTree.value, null);
  assert.equal(getJsonNodeValueText(nullTree), "null");
});

test("json-tree: parse empty object and empty array", () => {
  const emptyObj = parseJsonTree("{}");
  assert.ok(emptyObj && emptyObj.kind === "object");
  assert.equal(emptyObj.entries.length, 0);
  assert.equal(emptyObj.raw, "{}");

  const emptyArr = parseJsonTree("[]");
  assert.ok(emptyArr && emptyArr.kind === "array");
  assert.equal(emptyArr.items.length, 0);
  assert.equal(emptyArr.raw, "[]");
});

test("json-tree: copy primitive property and string value", () => {
  const json = JSON.stringify({ name: "John", age: 30, active: true, notes: null });
  const tree = parseJsonTree(json);
  assert.ok(tree && tree.kind === "object");

  const nameEntry = tree.entries.find((e) => e.key === "name");
  assert.ok(nameEntry);
  // Copy property
  assert.equal(formatJsonProperty(nameEntry.key, nameEntry.value), '"name": "John"');
  // Copy value (unquoted for string)
  assert.equal(getJsonNodeValueText(nameEntry.value), "John");

  const ageEntry = tree.entries.find((e) => e.key === "age");
  assert.ok(ageEntry);
  assert.equal(formatJsonProperty(ageEntry.key, ageEntry.value), '"age": 30');
  assert.equal(getJsonNodeValueText(ageEntry.value), "30");

  const activeEntry = tree.entries.find((e) => e.key === "active");
  assert.ok(activeEntry);
  assert.equal(formatJsonProperty(activeEntry.key, activeEntry.value), '"active": true');
  assert.equal(getJsonNodeValueText(activeEntry.value), "true");

  const notesEntry = tree.entries.find((e) => e.key === "notes");
  assert.ok(notesEntry);
  assert.equal(formatJsonProperty(notesEntry.key, notesEntry.value), '"notes": null');
  assert.equal(getJsonNodeValueText(notesEntry.value), "null");
});

test("json-tree: copy nested object and section", () => {
  const json = JSON.stringify({
    address: {
      city: "Riyadh",
      country: "Saudi Arabia",
    },
  });
  const tree = parseJsonTree(json);
  assert.ok(tree && tree.kind === "object");

  const addrEntry = tree.entries.find((e) => e.key === "address");
  assert.ok(addrEntry && addrEntry.value.kind === "object");

  // Copy property (key + formatted object)
  const propText = formatJsonProperty(addrEntry.key, addrEntry.value);
  assert.match(propText, /^"address":\s*\{/);
  assert.match(propText, /"city": "Riyadh"/);

  // Copy section (the object itself)
  assert.equal(addrEntry.value.raw, '{\n  "city": "Riyadh",\n  "country": "Saudi Arabia"\n}');
});

test("json-tree: copy nested array and deeply nested section", () => {
  const data = {
    users: [
      { name: "John" },
      { name: "Jane" },
    ],
    deep: {
      l1: {
        l2: {
          leaf: "deep-val",
        },
      },
    },
  };
  const tree = parseJsonTree(JSON.stringify(data));
  assert.ok(tree && tree.kind === "object");

  const usersEntry = tree.entries.find((e) => e.key === "users");
  assert.ok(usersEntry && usersEntry.value.kind === "array");
  assert.equal(usersEntry.value.items.length, 2);
  assert.equal(
    usersEntry.value.raw,
    '[\n  {\n    "name": "John"\n  },\n  {\n    "name": "Jane"\n  }\n]'
  );

  const deepEntry = tree.entries.find((e) => e.key === "deep");
  assert.ok(deepEntry && deepEntry.value.kind === "object");
  const l1Entry = deepEntry.value.entries.find((e) => e.key === "l1");
  assert.ok(l1Entry && l1Entry.value.kind === "object");
  const l2Entry = l1Entry.value.entries.find((e) => e.key === "l2");
  assert.ok(l2Entry && l2Entry.value.kind === "object");
  assert.equal(l2Entry.value.raw, '{\n  "leaf": "deep-val"\n}');
});

test("json-tree: large JSON structures parse correctly", () => {
  const largeObj = {};
  for (let i = 0; i < 200; i++) {
    largeObj[`item_${i}`] = { id: i, tags: ["a", "b", "c"] };
  }
  const tree = parseJsonTree(JSON.stringify(largeObj));
  assert.ok(tree && tree.kind === "object");
  assert.equal(tree.entries.length, 200);
  assert.equal(tree.entries[50].key, "item_50");
  assert.ok(tree.entries[50].value.raw.includes('"id": 50'));
});

test("json-tree: invalid JSON returns null", () => {
  assert.equal(parseJsonTree("{ invalid json"), null);
  assert.equal(parseJsonTree(""), null);
});

test("xml-tree: copy individual element and content", () => {
  const xml = "<name>John</name>";
  const nodes = parseXml(xml);
  assert.ok(nodes && nodes.length === 1);
  const node = nodes[0];
  assert.equal(formatXmlNode(node), "<name>John</name>");
  assert.equal(getXmlNodeContent(node), "John");
});

test("xml-tree: copy nested element and section", () => {
  const xml = "<address><city>Riyadh</city><country>Saudi Arabia</country></address>";
  const nodes = parseXml(xml);
  assert.ok(nodes && nodes.length === 1);
  const node = nodes[0];
  assert.equal(
    formatXmlNode(node),
    "<address>\n  <city>Riyadh</city>\n  <country>Saudi Arabia</country>\n</address>"
  );
  assert.equal(
    getXmlNodeContent(node),
    "<city>Riyadh</city>\n<country>Saudi Arabia</country>"
  );

  assert.ok(node.kind === "element");
  const cityChild = node.children.find((c) => c.kind === "element" && c.name === "city");
  assert.ok(cityChild);
  assert.equal(formatXmlNode(cityChild), "<city>Riyadh</city>");
  assert.equal(getXmlNodeContent(cityChild), "Riyadh");
});

test("xml-tree: copy self-closing element and element with attributes", () => {
  const xml = '<item id="123" active="true" />';
  const nodes = parseXml(xml);
  assert.ok(nodes && nodes.length === 1);
  const node = nodes[0];
  assert.equal(formatXmlNode(node), '<item id="123" active="true" />');
  assert.equal(getXmlNodeContent(node), "");
});

test("xml-tree: namespaces and CDATA", () => {
  const xml = '<h:table xmlns:h="http://www.w3.org/TR/html4/"><h:tr><![CDATA[Some <raw> data]]></h:tr></h:table>';
  const nodes = parseXml(xml);
  assert.ok(nodes && nodes.length === 1);
  const node = nodes[0];
  assert.ok(formatXmlNode(node).includes('xmlns:h="http://www.w3.org/TR/html4/"'));
  assert.ok(formatXmlNode(node).includes("<![CDATA[Some <raw> data]]>"));
});

test("xml-tree: deeply nested XML section", () => {
  const xml = `
    <root>
      <level1>
        <level2>
          <level3>deep content</level3>
        </level2>
      </level1>
    </root>
  `;
  const nodes = parseXml(xml);
  assert.ok(nodes);
  const root = nodes.find((n) => n.kind === "element" && n.name === "root");
  assert.ok(root && root.kind === "element");
  const l1 = root.children.find((c) => c.kind === "element" && c.name === "level1");
  assert.ok(l1 && l1.kind === "element");
  const l2 = l1.children.find((c) => c.kind === "element" && c.name === "level2");
  assert.ok(l2 && l2.kind === "element");
  assert.equal(
    formatXmlNode(l2),
    "<level2>\n  <level3>deep content</level3>\n</level2>"
  );
});

test("xml-tree: large XML structure", () => {
  let xml = "<catalog>";
  for (let i = 0; i < 150; i++) {
    xml += `<book id="b${i}"><title>Book ${i}</title></book>`;
  }
  xml += "</catalog>";

  const nodes = parseXml(xml);
  assert.ok(nodes && nodes.length === 1);
  const catalog = nodes[0];
  assert.ok(catalog.kind === "element");
  assert.equal(catalog.children.length, 150);
  assert.equal(formatXmlNode(catalog.children[10]), '<book id="b10">\n  <title>Book 10</title>\n</book>');
});

