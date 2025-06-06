import type { Element } from './Element.mjs';

export interface Model {
  strategy: {
    name: string;
    id: string;
    elements?: Element[];
  };
  business: {
    name: string;
    id: string;
    elements?: Element[];
  };
  application: {
    name: string;
    id: string;
    elements?: Element[];
  };
  technology: {
    name: string;
    id: string;
    elements?: Element[];
  };
  motivation: {
    name: string;
    id: string;
    elements?: Element[];
  };
  implementation_migration: {
    name: string;
    id: string;
    elements?: Element[];
  };
  other: {
    name: string;
    id: string;
    elements?: Element[];
  };
  relations: {
    name: string;
    id: string;
    elements?: Element[];
  };
  diagrams: {
    name: string;
    id: string;
    elements?: Element[];
  };
}

export type FolderKey = keyof Model;
