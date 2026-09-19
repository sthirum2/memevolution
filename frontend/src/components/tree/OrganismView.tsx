import { useCallback, useEffect, useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import type { Experiment } from '@/types'
import {
  BAND_H,
  BAND_PAD,
  NODE_H,
  NODE_W,
  generationsOf,
  layoutTree,
  treeExtent,
} from '@/lib/layout'
import { effectiveFitness } from '@/lib/fitness'
import SpecimenNode from './SpecimenNode'
import BandNode from './BandNode'
import LineageEdge, { type LineageKind } from './LineageEdge'
import TreeControls from './TreeControls'

const nodeTypes = { specimen: SpecimenNode, band: BandNode }
const edgeTypes = { lineage: LineageEdge }

function lineageKind(parent: Experiment, child: Experiment): LineageKind {
  if (child.status === 'extinct') return 'dead'
  if (child.status === 'pending' || child.status === 'predicted') return 'probe'
  if (parent.status === 'survived' || parent.status === 'deployed') return 'spine'
  return 'dead'
}

function Canvas() {
  const experiments = useStore((s) => s.experiments)
  const generations = useStore((s) => s.generations)
  const replayGen = useStore((s) => s.replayGen)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const setView = useStore((s) => s.setView)
  const { fitView, setCenter, getZoom } = useReactFlow()

  const gens = useMemo(() => generationsOf(experiments), [experiments])

  const { baseNodes, baseEdges } = useMemo(() => {
    const pos = layoutTree(experiments)
    const { minX, width } = treeExtent(pos)
    const byId = new Map(experiments.map((e) => [e.id, e]))

    const bands: Node[] = gens.map((g) => {
      const rows = experiments.filter((e) => e.generation === g)
      const scored = rows.filter((e) => e.observed.fitness !== null)
      const summary = generations.find((s) => s.generation === g)
      return {
        id: `band_${g}`,
        type: 'band',
        position: { x: minX - BAND_PAD, y: g * BAND_H - 52 },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -2,
        data: {
          generation: g,
          width: width + BAND_PAD * 2,
          label: g === 0 ? 'generation 0 · historical prior' : `generation ${g}`,
          count: rows.length,
          meanFitness:
            summary?.meanFitness ??
            (scored.length
              ? scored.reduce((a, e) => a + (e.observed.fitness ?? 0), 0) / scored.length
              : 0),
          dimmed: false,
        },
      }
    })

    const specimens: Node[] = experiments.map((e) => ({
      id: e.id,
      type: 'specimen',
      position: { x: pos.get(e.id)!.x, y: pos.get(e.id)!.y },
      draggable: false,
      connectable: false,
      zIndex: 1,
      data: { exp: e },
    }))

    const edges: Edge[] = experiments
      .filter((e) => e.parent_id && byId.has(e.parent_id))
      .map((e) => {
        const parent = byId.get(e.parent_id!)!
        const kind = lineageKind(parent, e)
        return {
          id: `${parent.id}->${e.id}`,
          source: parent.id,
          target: e.id,
          type: 'lineage',
          zIndex: kind === 'spine' ? 0 : -1,
          data: { kind, fitness: effectiveFitness(e), hidden: false },
        }
      })

    return { baseNodes: [...bands, ...specimens], baseEdges: edges }
  }, [experiments, gens, generations])

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(baseEdges)

  useEffect(() => {
    setNodes(baseNodes)
    setEdges(baseEdges)
  }, [baseNodes, baseEdges, setNodes, setEdges])

  // Replay / scrub: bands dim and edges hide for generations not yet revealed.
  useEffect(() => {
    setNodes((ns) =>
      ns.map((n) =>
        n.type === 'band'
          ? {
              ...n,
              data: {
                ...n.data,
                dimmed: replayGen !== null && (n.data.generation as number) > replayGen,
              },
            }
          : n,
      ),
    )
    setEdges((es) =>
      es.map((e) => {
        const targetGen = Number(e.target.replace(/\D/g, ''))
        const gen = experiments.find((x) => x.id === e.target)?.generation ?? targetGen
        return { ...e, data: { ...e.data, hidden: replayGen !== null && gen > replayGen } }
      }),
    )
  }, [replayGen, setNodes, setEdges, experiments])

  useEffect(() => {
    if (!experiments.length) return
    const t = setTimeout(() => fitView({ duration: 640, padding: 0.18 }), 120)
    return () => clearTimeout(t)
  }, [experiments.length, fitView])

  // The specimen panel covers the right edge of the canvas, so centring on a
  // selected node has to bias left by half the panel or the node lands behind it.
  const positions = useMemo(() => layoutTree(experiments), [experiments])
  useEffect(() => {
    if (!selectedId) return
    const p = positions.get(selectedId)
    if (!p) return
    const zoom = Math.max(getZoom(), 0.62)
    const panelBias = window.innerWidth >= 1024 ? 420 / 2 / zoom : 0
    setCenter(p.x + NODE_W / 2 + panelBias, p.y + NODE_H / 2, { zoom, duration: 520 })
  }, [selectedId, positions, setCenter, getZoom])

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type !== 'specimen') return
      select(node.id)
      setView('specimen')
    },
    [select, setView],
  )

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => select(null)}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
        minZoom={0.18}
        maxZoom={2.2}
        nodeOrigin={[0, 0]}
        defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={34}
          size={1}
          color="rgba(237,232,224,0.055)"
        />
      </ReactFlow>
      <TreeControls generations={gens} />
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden text-right text-2xs lowercase tracking-lab text-smoke/70 lg:block">
        <div>node size · glow · pulse rate = fitness</div>
        <div>click any specimen to open its lab report</div>
      </div>
      <style>{`
        .react-flow__node-specimen { width: ${NODE_W}px; height: ${NODE_H}px; }
      `}</style>
    </div>
  )
}

export default function OrganismView() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
