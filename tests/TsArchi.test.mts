import { describe, it, expect, vi, type Mock } from 'vitest';
import { TsArchi } from '../src/node/TsArchi.mjs';
import { readFile, writeFile } from 'fs/promises';
import type { Schema } from '../src/interfaces/schema/Schema.mjs';

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

  it('should throw an ArchimateParseError for XML that is not an Archi model', async () => {
    (readFile as Mock).mockResolvedValue(invalidXml);

    const tsArchi = new TsArchi();

    await expect(tsArchi.load('dummy/path/to/invalid.xml')).rejects.toMatchObject({
      name: 'ArchimateParseError',
      kind: 'not-archimate'
    });
  });

  it('should throw from loadModel instead of returning an empty model', async () => {
    (readFile as Mock).mockResolvedValue('<archimate:model><folder></archimate:model>');

    const tsArchi = new TsArchi();

    await expect(tsArchi.loadModel('dummy/path/to/broken.archimate')).rejects.toMatchObject({
      name: 'ArchimateParseError',
      kind: 'not-xml',
      line: 1
    });
  });

  it('should pass on file read errors', async () => {
    (readFile as Mock).mockRejectedValue(new Error('File not found'));

    const tsArchi = new TsArchi();

    await expect(tsArchi.load('dummy/path/to/nonexistent.xml')).rejects.toThrow('File not found');
    await expect(tsArchi.loadModel('dummy/path/to/nonexistent.xml')).rejects.toThrow('File not found');
  });

  it('should write the same XML as Archimate.toXml', async () => {
    vi.clearAllMocks();
    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const tsArchi = new TsArchi();
    const model = await tsArchi.loadModel('dummy/path/to/model.archimate');
    await tsArchi.saveModel('dummy/path/to/output.archimate');

    expect(writeFile).toHaveBeenCalledWith('dummy/path/to/output.archimate', model.toXml(), 'utf8');
  });

  it('should validate the model before saving', async () => {
    vi.clearAllMocks();

    const tsArchi = new TsArchi();
    const model = tsArchi.getModel();
    model.upsertElement({
      id: 'app-1',
      name: 'App 1',
      type: 'ApplicationComponent'
    });
    model.upsertElement({
      id: 'broken-rel',
      name: 'Broken Relationship',
      type: 'FlowRelationship',
      source: 'app-1',
      target: 'missing-target'
    });

    await expect(tsArchi.saveModel('dummy/path/to/output.archimate')).rejects.toMatchObject({
      name: 'ArchimateValidationError'
    });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
