import { describe, it, expect, vi, type Mock } from 'vite-plus/test';
import { loadModel, saveModel } from '../src/node/ModelFiles.mjs';
import { Archimate } from '../src/Archimate.mjs';
import { readFile, writeFile } from 'fs/promises';

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe('loadModel and saveModel', () => {
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

  it('should load the elements and folders of an .archimate file', async () => {
    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const model = await loadModel('dummy/path/to/model.archimate');

    expect(model.getName()).toBe('Test Model');
    expect(model.getElement('id-test-actor')).toMatchObject({ type: 'BusinessActor', name: 'Test Actor' });
    expect(model.getFolder('technology').name).toBe('Technology & Physical');
  });

  it('should throw an ArchimateParseError for XML that is not an Archi model', async () => {
    (readFile as Mock).mockResolvedValue(invalidXml);

    await expect(loadModel('dummy/path/to/invalid.xml')).rejects.toMatchObject({
      name: 'ArchimateParseError',
      kind: 'not-archimate',
    });
  });

  it('should throw from loadModel instead of returning an empty model', async () => {
    (readFile as Mock).mockResolvedValue('<archimate:model><folder></archimate:model>');

    await expect(loadModel('dummy/path/to/broken.archimate')).rejects.toMatchObject({
      name: 'ArchimateParseError',
      kind: 'not-xml',
      line: 1,
    });
  });

  it('should pass on file read errors', async () => {
    (readFile as Mock).mockRejectedValue(new Error('File not found'));

    await expect(loadModel('dummy/path/to/nonexistent.xml')).rejects.toThrow('File not found');
  });

  it('should write the same XML as Archimate.toXml', async () => {
    vi.clearAllMocks();
    (readFile as Mock).mockResolvedValue(validArchimateXml);

    const model = await loadModel('dummy/path/to/model.archimate');
    await saveModel(model, 'dummy/path/to/output.archimate');

    expect(writeFile).toHaveBeenCalledWith('dummy/path/to/output.archimate', model.toXml(), 'utf8');
  });

  it('should save a model built in code', async () => {
    vi.clearAllMocks();
    const model = new Archimate();
    model.upsertElement({ id: 'app-1', name: 'App 1', type: 'ApplicationComponent' });

    await saveModel(model, 'dummy/path/to/new.archimate');

    expect(writeFile).toHaveBeenCalledWith('dummy/path/to/new.archimate', model.toXml(), 'utf8');
  });

  it('should validate the model before saving', async () => {
    vi.clearAllMocks();

    const model = new Archimate();
    model.upsertElement({
      id: 'app-1',
      name: 'App 1',
      type: 'ApplicationComponent',
    });
    model.upsertElement({
      id: 'broken-rel',
      name: 'Broken Relationship',
      type: 'FlowRelationship',
      source: 'app-1',
      target: 'missing-target',
    });

    await expect(saveModel(model, 'dummy/path/to/output.archimate')).rejects.toMatchObject({
      name: 'ArchimateValidationError',
    });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
