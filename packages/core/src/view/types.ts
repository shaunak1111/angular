/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import {Injector} from '../di';
import {NgModuleRef} from '../linker/ng_module_factory';
import {QueryList} from '../linker/query_list';
import {TemplateRef} from '../linker/template_ref';
import {ViewContainerRef} from '../linker/view_container_ref';
import {Renderer2, RendererFactory2, RendererType2} from '../render/api';
import {Sanitizer, SecurityContext} from '../security';

// -------------------------------------
// Defs
// -------------------------------------

export interface ViewDefinition {
  factory: ViewDefinitionFactory;
  flags: ViewFlags;
  updateDirectives: ViewUpdateFn;
  updateRenderer: ViewUpdateFn;
  handleEvent: ViewHandleEventFn;
  /**
   * Order: Depth first.
   * Especially providers are before elements / anchors.
   */
  nodes: NodeDef[];
  /** aggregated NodeFlags for all nodes **/
  nodeFlags: NodeFlags;
  rootNodeFlags: NodeFlags;
  lastRenderRootNode: NodeDef;
  bindingCount: number;
  outputCount: number;
  /**
   * Binary or of all query ids that are matched by one of the nodes.
   * This includes query ids from templates as well.
   * Used as a bloom filter.
   */
  nodeMatchedQueries: number;
}

/**
 * Factory for ViewDefinitions.
 * We use a function so we can reexeute it in case an error happens and use the given logger
 * function to log the error from the definition of the node, which is shown in all browser
 * logs.
 */
export interface ViewDefinitionFactory { (logger: NodeLogger): ViewDefinition; }

/**
 * Function to call console.error at the right source location. This is an indirection
 * via another function as browser will log the location that actually called
 * `console.error`.
 */
export interface NodeLogger { (): () => void; }

export interface ViewUpdateFn { (check: NodeCheckFn, view: ViewData): void; }

// helper functions to create an overloaded function type.
export interface NodeCheckFn {
  (view: ViewData, nodeIndex: number, argStyle: ArgumentType.Dynamic, values: any[]): any;

  (view: ViewData, nodeIndex: number, argStyle: ArgumentType.Inline, v0?: any, v1?: any, v2?: any,
   v3?: any, v4?: any, v5?: any, v6?: any, v7?: any, v8?: any, v9?: any): any;
}

export const enum ArgumentType {Inline, Dynamic}

export interface ViewHandleEventFn {
  (view: ViewData, nodeIndex: number, eventName: string, event: any): boolean;
}

/**
 * Bitmask for ViewDefintion.flags.
 */
export const enum ViewFlags {
  None = 0,
  OnPush = 1 << 1,
}

/**
 * A node definition in the view.
 *
 * Note: We use one type for all nodes so that loops that loop over all nodes
 * of a ViewDefinition stay monomorphic!
 */
export interface NodeDef {
  flags: NodeFlags;
  index: number;
  parent: NodeDef;
  renderParent: NodeDef;
  /** this is checked against NgContentDef.index to find matched nodes */
  ngContentIndex: number;
  /** number of transitive children */
  childCount: number;
  /** aggregated NodeFlags for all transitive children (does not include self) **/
  childFlags: NodeFlags;
  /** aggregated NodeFlags for all direct children (does not include self) **/
  directChildFlags: NodeFlags;

  bindingIndex: number;
  bindings: BindingDef[];
  bindingFlags: BindingFlags;
  outputIndex: number;
  outputs: OutputDef[];
  /**
   * references that the user placed on the element
   */
  references: {[refId: string]: QueryValueType};
  /**
   * ids and value types of all queries that are matched by this node.
   */
  matchedQueries: {[queryId: number]: QueryValueType};
  /** Binary or of all matched query ids of this node. */
  matchedQueryIds: number;
  /**
   * Binary or of all query ids that are matched by one of the children.
   * This includes query ids from templates as well.
   * Used as a bloom filter.
   */
  childMatchedQueries: number;
  element: ElementDef;
  provider: ProviderDef;
  text: TextDef;
  query: QueryDef;
  ngContent: NgContentDef;
}

/**
 * Bitmask for NodeDef.flags.
 * Naming convention:
 * - `Type...`: flags that are mutually exclusive
 * - `Cat...`: union of multiple `Type...` (short for category).
 */
export const enum NodeFlags {
  None = 0,
  TypeElement = 1 << 0,
  TypeText = 1 << 1,
  CatRenderNode = TypeElement | TypeText,
  TypeNgContent = 1 << 2,
  TypePipe = 1 << 3,
  TypePureArray = 1 << 4,
  TypePureObject = 1 << 5,
  TypePurePipe = 1 << 6,
  CatPureExpression = TypePureArray | TypePureObject | TypePurePipe,
  TypeValueProvider = 1 << 7,
  TypeClassProvider = 1 << 8,
  TypeFactoryProvider = 1 << 9,
  TypeUseExistingProvider = 1 << 10,
  LazyProvider = 1 << 11,
  PrivateProvider = 1 << 12,
  TypeDirective = 1 << 13,
  Component = 1 << 14,
  CatProvider = TypeValueProvider | TypeClassProvider | TypeFactoryProvider |
      TypeUseExistingProvider | TypeDirective,
  OnInit = 1 << 15,
  OnDestroy = 1 << 16,
  DoCheck = 1 << 17,
  OnChanges = 1 << 18,
  AfterContentInit = 1 << 19,
  AfterContentChecked = 1 << 20,
  AfterViewInit = 1 << 21,
  AfterViewChecked = 1 << 22,
  EmbeddedViews = 1 << 23,
  ComponentView = 1 << 24,
  TypeContentQuery = 1 << 25,
  TypeViewQuery = 1 << 26,
  StaticQuery = 1 << 27,
  DynamicQuery = 1 << 28,
  CatQuery = TypeContentQuery | TypeViewQuery,

  // mutually exclusive values...
  Types = CatRenderNode | TypeNgContent | TypePipe | CatPureExpression | CatProvider | CatQuery
}

export interface BindingDef {
  flags: BindingFlags;
  ns: string;
  name: string;
  nonMinifiedName: string;
  securityContext: SecurityContext;
  suffix: string;
}

export const enum BindingFlags {
  TypeElementAttribute = 1 << 0,
  TypeElementClass = 1 << 1,
  TypeElementStyle = 1 << 2,
  TypeProperty = 1 << 3,
  SyntheticProperty = 1 << 4,
  SyntheticHostProperty = 1 << 5,
  CatSyntheticProperty = SyntheticProperty | SyntheticHostProperty,

  // mutually exclusive values...
  Types = TypeElementAttribute | TypeElementClass | TypeElementStyle | TypeProperty
}

export interface OutputDef {
  type: OutputType;
  target: 'window'|'document'|'body'|'component';
  eventName: string;
  propName: string;
}

export const enum OutputType {ElementOutput, DirectiveOutput}

export const enum QueryValueType {
  ElementRef,
  RenderElement,
  TemplateRef,
  ViewContainerRef,
  Provider
}

export interface ElementDef {
  name: string;
  ns: string;
  /** ns, name, value */
  attrs: [string, string, string][];
  template: ViewDefinition;
  componentProvider: NodeDef;
  componentRendererType: RendererType2;
  // closure to allow recursive components
  componentView: ViewDefinitionFactory;
  /**
   * visible public providers for DI in the view,
   * as see from this element. This does not include private providers.
   */
  publicProviders: {[tokenKey: string]: NodeDef};
  /**
   * same as visiblePublicProviders, but also includes private providers
   * that are located on this element.
   */
  allProviders: {[tokenKey: string]: NodeDef};
  handleEvent: ElementHandleEventFn;
}

export interface ElementHandleEventFn { (view: ViewData, eventName: string, event: any): boolean; }

export interface ProviderDef {
  token: any;
  tokenKey: string;
  value: any;
  deps: DepDef[];
}

export interface DepDef {
  flags: DepFlags;
  token: any;
  tokenKey: string;
}

/**
 * Bitmask for DI flags
 */
export const enum DepFlags {
  None = 0,
  SkipSelf = 1 << 0,
  Optional = 1 << 1,
  Value = 2 << 2,
}

export interface TextDef { prefix: string; }

export interface QueryDef {
  id: number;
  // variant of the id that can be used to check against NodeDef.matchedQueryIds, ...
  filterId: number;
  bindings: QueryBindingDef[];
}

export interface QueryBindingDef {
  propName: string;
  bindingType: QueryBindingType;
}

export const enum QueryBindingType {First, All}

export interface NgContentDef {
  /**
   * this index is checked against NodeDef.ngContentIndex to find the nodes
   * that are matched by this ng-content.
   * Note that a NodeDef with an ng-content can be reprojected, i.e.
   * have a ngContentIndex on its own.
   */
  index: number;
}

// -------------------------------------
// Data
// -------------------------------------

/**
 * View instance data.
 * Attention: Adding fields to this is performance sensitive!
 */
export interface ViewData {
  def: ViewDefinition;
  root: RootData;
  renderer: Renderer2;
  // index of component provider / anchor.
  parentNodeDef: NodeDef;
  parent: ViewData;
  viewContainerParent: ViewData;
  component: any;
  context: any;
  // Attention: Never loop over this, as this will
  // create a polymorphic usage site.
  // Instead: Always loop over ViewDefinition.nodes,
  // and call the right accessor (e.g. `elementData`) based on
  // the NodeType.
  nodes: {[key: number]: NodeData};
  state: ViewState;
  oldValues: any[];
  disposables: DisposableFn[];
}

/**
 * Bitmask of states
 */
export const enum ViewState {
  FirstCheck = 1 << 0,
  ChecksEnabled = 1 << 1,
  Errored = 1 << 2,
  Destroyed = 1 << 3
}

export interface DisposableFn { (): void; }

/**
 * Node instance data.
 *
 * We have a separate type per NodeType to save memory
 * (TextData | ElementData | ProviderData | PureExpressionData | QueryList<any>)
 *
 * To keep our code monomorphic,
 * we prohibit using `NodeData` directly but enforce the use of accessors (`asElementData`, ...).
 * This way, no usage site can get a `NodeData` from view.nodes and then use it for different
 * purposes.
 */
export class NodeData { private __brand: any; }

/**
 * Data for an instantiated NodeType.Text.
 *
 * Attention: Adding fields to this is performance sensitive!
 */
export interface TextData { renderText: any; }

/**
 * Accessor for view.nodes, enforcing that every usage site stays monomorphic.
 */
export function asTextData(view: ViewData, index: number): TextData {
  return <any>view.nodes[index];
}

/**
 * Data for an instantiated NodeType.Element.
 *
 * Attention: Adding fields to this is performance sensitive!
 */
export interface ElementData {
  renderElement: any;
  componentView: ViewData;
  viewContainer: ViewContainerData;
  template: TemplateData;
}

export interface ViewContainerData extends ViewContainerRef { _embeddedViews: ViewData[]; }

export interface TemplateData extends TemplateRef<any> {
  // views that have been created from the template
  // of this element,
  // but inserted into the embeddedViews of another element.
  // By default, this is undefined.
  _projectedViews: ViewData[];
}

/**
 * Accessor for view.nodes, enforcing that every usage site stays monomorphic.
 */
export function asElementData(view: ViewData, index: number): ElementData {
  return <any>view.nodes[index];
}

/**
 * Data for an instantiated NodeType.Provider.
 *
 * Attention: Adding fields to this is performance sensitive!
 */
export interface ProviderData { instance: any; }

/**
 * Accessor for view.nodes, enforcing that every usage site stays monomorphic.
 */
export function asProviderData(view: ViewData, index: number): ProviderData {
  return <any>view.nodes[index];
}

/**
 * Data for an instantiated NodeType.PureExpression.
 *
 * Attention: Adding fields to this is performance sensitive!
 */
export interface PureExpressionData { value: any; }

/**
 * Accessor for view.nodes, enforcing that every usage site stays monomorphic.
 */
export function asPureExpressionData(view: ViewData, index: number): PureExpressionData {
  return <any>view.nodes[index];
}

/**
 * Accessor for view.nodes, enforcing that every usage site stays monomorphic.
 */
export function asQueryList(view: ViewData, index: number): QueryList<any> {
  return <any>view.nodes[index];
}

export interface RootData {
  injector: Injector;
  ngModule: NgModuleRef<any>;
  projectableNodes: any[][];
  selectorOrNode: any;
  renderer: Renderer2;
  rendererFactory: RendererFactory2;
  sanitizer: Sanitizer;
}

export abstract class DebugContext {
  abstract get view(): ViewData;
  abstract get nodeIndex(): number;
  abstract get injector(): Injector;
  abstract get component(): any;
  abstract get providerTokens(): any[];
  abstract get references(): {[key: string]: any};
  abstract get context(): any;
  abstract get componentRenderElement(): any;
  abstract get renderNode(): any;
  abstract logError(console: Console, ...values: any[]): void;
}

// -------------------------------------
// Other
// -------------------------------------

export const enum CheckType {CheckAndUpdate, CheckNoChanges}

export interface Services {
  setCurrentNode(view: ViewData, nodeIndex: number): void;
  createRootView(
      injector: Injector, projectableNodes: any[][], rootSelectorOrNode: string|any,
      def: ViewDefinition, ngModule: NgModuleRef<any>, context?: any): ViewData;
  createEmbeddedView(parent: ViewData, anchorDef: NodeDef, context?: any): ViewData;
  checkAndUpdateView(view: ViewData): void;
  checkNoChangesView(view: ViewData): void;
  destroyView(view: ViewData): void;
  resolveDep(
      view: ViewData, elDef: NodeDef, allowPrivateServices: boolean, depDef: DepDef,
      notFoundValue?: any): any;
  createDebugContext(view: ViewData, nodeIndex: number): DebugContext;
  handleEvent: ViewHandleEventFn;
  updateDirectives: (view: ViewData, checkType: CheckType) => void;
  updateRenderer: (view: ViewData, checkType: CheckType) => void;
  dirtyParentQueries: (view: ViewData) => void;
}

/**
 * This object is used to prevent cycles in the source files and to have a place where
 * debug mode can hook it. It is lazily filled when `isDevMode` is known.
 */
export const Services: Services = {
  setCurrentNode: undefined,
  createRootView: undefined,
  createEmbeddedView: undefined,
  checkAndUpdateView: undefined,
  checkNoChangesView: undefined,
  destroyView: undefined,
  resolveDep: undefined,
  createDebugContext: undefined,
  handleEvent: undefined,
  updateDirectives: undefined,
  updateRenderer: undefined,
  dirtyParentQueries: undefined,
};
