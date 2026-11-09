// Widget registry: data-widget name → Svelte component.
import YamlTree from './YamlTree.svelte';
import CidrCalc from './CidrCalc.svelte';
import NatDiagram from './NatDiagram.svelte';
import ScopeTree from './ScopeTree.svelte';
import LayerStack from './LayerStack.svelte';
import OneVm from './OneVm.svelte';
import ClusterDiagram from './ClusterDiagram.svelte';
import Reconcile from './Reconcile.svelte';
import Terminal from './Terminal.svelte';
import PodAnatomy from './PodAnatomy.svelte';
import SelectorMatcher from './SelectorMatcher.svelte';
import RolloutSim from './RolloutSim.svelte';
import ServiceTraffic from './ServiceTraffic.svelte';
import NodeCapacity from './NodeCapacity.svelte';
import SchedulerSim from './SchedulerSim.svelte';
import ProbeTimeline from './ProbeTimeline.svelte';
import HpaSim from './HpaSim.svelte';
import ResponsibilitySorter from './ResponsibilitySorter.svelte';
import LbBuilder from './LbBuilder.svelte';
import IdentityMap from './IdentityMap.svelte';
import TokenFlow from './TokenFlow.svelte';
import PrivateClusterNet from './PrivateClusterNet.svelte';
import RequestRouter from './RequestRouter.svelte';
import NetpolEval from './NetpolEval.svelte';
import Ch07 from './Ch07.svelte';
import KustomizeLite from './KustomizeLite.svelte';
import HelmLite from './HelmLite.svelte';
import StageSim from './StageSim.svelte';
import CanaryDashboard from './CanaryDashboard.svelte';
import PlanSymbols from './PlanSymbols.svelte';
import StateDiagram from './StateDiagram.svelte';
import IacEditor from './IacEditor.svelte';
import BicepCompile from './BicepCompile.svelte';
import DeployModes from './DeployModes.svelte';
import FollowThePacket from './FollowThePacket.svelte';
import RbacEval from './RbacEval.svelte';
import PolicyRules from './PolicyRules.svelte';
import SupplyChainMap from './SupplyChainMap.svelte';
import ArchitectureDiagram from './ArchitectureDiagram.svelte';
import MultiFileReview from './MultiFileReview.svelte';

export const registry = {
  'yaml-tree': YamlTree,
  'cidr-calc': CidrCalc,
  'nat-diagram': NatDiagram,
  'scope-tree': ScopeTree,
  'layer-stack': LayerStack,
  'one-vm': OneVm,
  'cluster-diagram': ClusterDiagram,
  reconcile: Reconcile,
  terminal: Terminal,
  'pod-anatomy': PodAnatomy,
  'selector-matcher': SelectorMatcher,
  'rollout-sim': RolloutSim,
  'service-traffic': ServiceTraffic,
  'node-capacity': NodeCapacity,
  'scheduler-sim': SchedulerSim,
  'probe-timeline': ProbeTimeline,
  'hpa-sim': HpaSim,
  'responsibility-sorter': ResponsibilitySorter,
  'lb-builder': LbBuilder,
  'identity-map': IdentityMap,
  'token-flow': TokenFlow,
  'private-cluster-net': PrivateClusterNet,
  'request-router': RequestRouter,
  'netpol-eval': NetpolEval,
  'kustomize-lite': KustomizeLite,
  'helm-lite': HelmLite,
  'stage-sim': StageSim,
  'canary-dashboard': CanaryDashboard,
  'plan-symbols': PlanSymbols,
  'state-diagram': StateDiagram,
  'iac-editor': IacEditor,
  'bicep-compile': BicepCompile,
  'deploy-modes': DeployModes,
  'follow-the-packet': FollowThePacket,
  'rbac-eval': RbacEval,
  'policy-rules': PolicyRules,
  'supply-chain-map': SupplyChainMap,
  'architecture-diagram': ArchitectureDiagram,
  'multi-file-review': MultiFileReview,
  // Chapter 7 panels ported from the preview
  ...Object.fromEntries(['l1-step2', 'l1-step3', 'l1-step4', 'l1-step6', 'l3-step7', 'l3-step8', 'l4-step9', 'l5-step6', 'l5-step7', 'l5-step10', 'l6-step3'].map((n) => [n, Ch07])),
  'l4-step4': TokenFlow,
  'l4-step5': TokenFlow,
};

// Chapter 7 panels converted from the preview that are plain content (tables, lists).
const STATIC = new Set(['l1-step7', 'l1-step9', 'l1-step11', 'l3-step1', 'l3-step3', 'l3-step6', 'l3-step10', 'l4-step2', 'l4-step7', 'l4-step11', 'l5-step8', 'l5-step11', 'l6-step10']);
export const staticWidget = (name) => STATIC.has(name);

// Widgets that detect their own success inside a "custom" check.
const SOLVABLE = new Set([
  'yaml-tree', 'cidr-calc', 'scope-tree', 'reconcile', 'selector-matcher', 'scheduler-sim', 'rollout-sim',
  'responsibility-sorter', 'token-flow', 'private-cluster-net', 'request-router', 'netpol-eval', 'kustomize-lite',
  'stage-sim', 'canary-dashboard', 'iac-editor', 'follow-the-packet', 'rbac-eval', 'policy-rules',
  'l3-step8', 'l4-step9', 'l5-step7',
]);
export const solvable = (name) => !!name && SOLVABLE.has(name) && !!registry[name];

// Widgets that read the rest of the check's prompt as data (and hide it).
const CONSUMES = new Set(['responsibility-sorter']);
export const consumesContext = (name) => !!name && CONSUMES.has(name) && !!registry[name];
