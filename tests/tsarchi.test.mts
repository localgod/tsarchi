import { describe, it, expect, vi, type Mock } from 'vitest';
import { TsArchi } from '../src/TsArchi.mjs';
import { readFile } from 'fs/promises';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';
import type { Element } from '../src/interfaces/Element.mjs';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

describe('TsArchi XML Parsing and Manipulation', () => { 

  const validArchimateXml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <archimate:model xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:archimate="http://www.archimatetool.com/archimate" name="Test Model" id="id-test-model" version="5.0.0">
      <folder name="Business" id="id-business-folder" type="business">
        <element xsi:type="archimate:BusinessActor" name="Test Actor" id="id-test-actor"/>
      </folder>
      <folder name="Application" id="id-application-folder" type="application">
        <!-- No elements here initially -->
      </folder>
      <folder name="Technology &amp; Physical" id="id-technology-physical-folder" type="technology"/>
    </archimate:model>
  `;

  const invalidXml = `
    <not-archimate>
      <some-tag>value</some-tag>
    </not-archimate>
  `;

  it('should successfully parse valid Archimate XML and contain the archimate:model section', async () => {
    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const tsArchi = new TsArchi();
    const parsedData = await tsArchi.load('dummy/path/to/model.xml') as Schema;

    expect(parsedData).toBeDefined();
    expect(parsedData).toHaveProperty('archimate:model');
    expect(parsedData['archimate:model']).toBeDefined();
  });

  it('should contain specific folders within the archimate:model section', async () => {

    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const tsArchi = new TsArchi();
    const parsedData = await tsArchi.load('dummy/path/to/model.xml') as Schema;

    expect(parsedData['archimate:model']).toHaveProperty('folder');
    expect(Array.isArray(parsedData['archimate:model'].folder)).toBe(true);
    expect(parsedData['archimate:model'].folder.length).toBeGreaterThan(0);
 
    const folders = parsedData['archimate:model'].folder;
    const businessFolder = folders.find((f: any) => f['@_type'] === 'business');
    const applicationFolder = folders.find((f: any) => f['@_type'] === 'application');
    const technologyFolder = folders.find((f: any) => f['@_type'] === 'technology');

    expect(businessFolder).toBeDefined();
    expect(businessFolder).toHaveProperty('@_name', 'Business');
    expect(applicationFolder).toBeDefined();
    expect(applicationFolder).toHaveProperty('@_name', 'Application');
    expect(technologyFolder).toBeDefined();
    expect(technologyFolder).toHaveProperty('@_name', 'Technology & Physical');
  });

  it('should contain elements within a specific folder', async () => {
    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const tsArchi = new TsArchi();
    const parsedData = await tsArchi.load('dummy/path/to/model.xml') as Schema;
    const folders = parsedData['archimate:model'].folder;
    const businessFolder = folders.find((f: any) => f['@_type'] === 'business');

    expect(businessFolder).toBeDefined();
    expect(businessFolder).toHaveProperty('element');

    const elements = Array.isArray(businessFolder!.element)
      ? businessFolder!.element
      : [businessFolder!.element];

    expect(Array.isArray(elements)).toBe(true);

    expect(elements.length).toBeGreaterThan(0);
    const testActorElement = elements.find((e: any) => e['@_name'] === 'Test Actor');
    expect(testActorElement).toBeDefined();
    expect(testActorElement).toHaveProperty('@_xsi:type', 'archimate:BusinessActor');
    expect(testActorElement).toHaveProperty('@_id', 'id-test-actor');
  });

  it('should return an empty object for invalid XML', async () => {
    (readFile as Mock).mockResolvedValue(invalidXml);

    const tsArchi = new TsArchi();
    const parsedData = await tsArchi.load('dummy/path/to/invalid.xml');

    expect(parsedData).toBeDefined();
    expect(parsedData).toEqual({});
  });

  it('should successfully add an element to a specified folder', async () => {
    (readFile as Mock).mockResolvedValue(validArchimateXml);
    const tsArchi = new TsArchi();
    await tsArchi.load('dummy/path/to/model.xml');

    const newAppComponent: Element = {
      id: 'tytter',
      type: 'ApplicationComponent',
      name: 'New Application Component',
      properties: new Map([['version', '1.0'], ['status', 'planned']])
    };

    tsArchi.addElementToModel(newAppComponent);
    const model = tsArchi.model
    const j = model.findElementInFolderByName('application', 'New Application Component');
    expect(j).toBeDefined();
    expect(j).toHaveProperty('name');
    expect(j).toHaveProperty('type');
    expect(j).toHaveProperty('id');
    expect(j).toHaveProperty('properties');
  });
});
