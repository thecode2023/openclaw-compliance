"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Search,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Network,
} from "lucide-react";
import Link from "next/link";

interface RegulationNode {
  id: string;
  title: string;
  jurisdiction: string;
  jurisdiction_display: string;
  status: string;
  category: string;
  summary: string;
}

interface Relationship {
  id: string;
  source_regulation_id: string;
  target_regulation_id: string;
  relationship_type: string;
  description: string;
  strength: string;
}

interface GraphClientProps {
  regulations: RegulationNode[];
  relationships: Relationship[];
}

const REGION_MAP: Record<string, string> = {};
const assignRegion = (codes: string[], region: string) =>
  codes.forEach((c) => (REGION_MAP[c] = region));
assignRegion(["EU", "GB"], "Europe");
assignRegion(["US", "US-TX", "US-CO", "US-IL", "US-CA", "US-CT", "US-UT", "US-TN", "US-NYC", "US-MD", "CA"], "North America");
assignRegion(["CN", "JP", "KR", "SG", "AU", "IN", "ID", "TH", "VN", "PH", "HK", "TW"], "Asia-Pacific");
assignRegion(["BR", "MX"], "Latin America");
assignRegion(["SA", "AE", "IL", "NG", "KE", "ZA"], "Middle East & Africa");
assignRegion(["INTL", "OECD"], "International");

function getRegion(jurisdiction: string): string {
  if (REGION_MAP[jurisdiction]) return REGION_MAP[jurisdiction];
  for (const [prefix, region] of Object.entries(REGION_MAP)) {
    if (jurisdiction.startsWith(prefix)) return region;
  }
  return "Other";
}

const REGION_COLORS: Record<string, string> = {
  "Europe": "#818CF8",
  "North America": "#F87171",
  "Asia-Pacific": "#34D399",
  "Latin America": "#FBBF24",
  "Middle East & Africa": "#22D3EE",
  "International": "#A5B4FC",
  "Other": "#8B87B8",
};

const EDGE_COLORS: Record<string, string> = {
  triggers: "#EF4444",
  requires: "#F97316",
  conflicts_with: "#EF4444",
  supplements: "#818CF8",
  supersedes: "#6B7280",
  references: "#4B5563",
};

const EDGE_LABELS: Record<string, string> = {
  triggers: "triggers",
  requires: "requires",
  conflicts_with: "conflicts with",
  supplements: "supplements",
  supersedes: "supersedes",
  references: "references",
};

const REGIONS = ["All", "Europe", "North America", "Asia-Pacific", "Latin America", "Middle East & Africa", "International"];
const REL_TYPES = ["All", "triggers", "requires", "conflicts_with", "supplements", "supersedes", "references"];

export function GraphClient({ regulations, relationships }: GraphClientProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<RegulationNode | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("All");
  const [relFilter, setRelFilter] = useState("All");
  const [isMobile, setIsMobile] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Filter nodes
  const connectedRegIds = new Set<string>();
  relationships.forEach((r) => {
    connectedRegIds.add(r.source_regulation_id);
    connectedRegIds.add(r.target_regulation_id);
  });

  const filteredNodes = regulations.filter((r) => {
    if (!connectedRegIds.has(r.id)) return false;
    if (regionFilter !== "All" && getRegion(r.jurisdiction) !== regionFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
  const filteredEdges = relationships.filter((r) => {
    if (!filteredNodeIds.has(r.source_regulation_id) || !filteredNodeIds.has(r.target_regulation_id)) return false;
    if (relFilter !== "All" && r.relationship_type !== relFilter) return false;
    return true;
  });

  // Connection counts
  const connectionCount = new Map<string, number>();
  filteredEdges.forEach((e) => {
    connectionCount.set(e.source_regulation_id, (connectionCount.get(e.source_regulation_id) || 0) + 1);
    connectionCount.set(e.target_regulation_id, (connectionCount.get(e.target_regulation_id) || 0) + 1);
  });

  // Get connections for a node
  const getConnections = useCallback(
    (nodeId: string) => {
      return relationships
        .filter((r) => r.source_regulation_id === nodeId || r.target_regulation_id === nodeId)
        .map((r) => {
          const isSource = r.source_regulation_id === nodeId;
          const otherId = isSource ? r.target_regulation_id : r.source_regulation_id;
          const other = regulations.find((reg) => reg.id === otherId);
          return {
            ...r,
            direction: isSource ? "outgoing" : "incoming",
            otherTitle: other?.title || "Unknown",
            otherJurisdiction: other?.jurisdiction_display || "",
          };
        });
    },
    [regulations, relationships]
  );

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // D3 graph rendering
  useEffect(() => {
    if (isMobile || !svgRef.current || filteredNodes.length === 0) return;

    let destroyed = false;

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d3 = await import("d3") as any;
      if (destroyed) return;

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = svgRef.current!.clientWidth;
      const height = svgRef.current!.clientHeight;

      const nodeMap = new Map(filteredNodes.map((n) => [n.id, n]));

      const nodes: any[] = filteredNodes.map((n) => ({
        ...n,
        radius: Math.min(8 + (connectionCount.get(n.id) || 0) * 2, 20),
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const links: any[] = filteredEdges.map((e) => ({
        source: e.source_regulation_id,
        target: e.target_regulation_id,
        type: e.relationship_type,
        description: e.description,
        strength: e.strength,
      }));

      const simulation = d3
        .forceSimulation(nodes)
        .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
        .force("charge", d3.forceManyBody().strength(-200))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius((d: any) => d.radius + 5));

      const g = svg.append("g");

      // Zoom
      const zoom = d3
        .zoom()
        .scaleExtent([0.2, 4])
        .on("zoom", (event: any) => g.attr("transform", event.transform));
      svg.call(zoom);

      // Edges
      const link = g
        .append("g")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", (d: any) => EDGE_COLORS[d.type] || "#4B5563")
        .attr("stroke-width", (d: any) => (d.strength === "strong" ? 2 : d.strength === "moderate" ? 1.5 : 1))
        .attr("stroke-dasharray", (d: any) => (d.type === "conflicts_with" ? "5,3" : d.type === "references" ? "2,2" : "none"))
        .attr("stroke-opacity", 0.6);

      // Nodes
      const node = g
        .append("g")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", (d: any) => d.radius)
        .attr("fill", (d: any) => REGION_COLORS[getRegion(d.jurisdiction)] || "#8B87B8")
        .attr("stroke", "#0B0A1A")
        .attr("stroke-width", 1.5)
        .attr("cursor", "pointer")
        .call(
          d3
            .drag()
            .on("start", (event: any, d: any) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event: any, d: any) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event: any, d: any) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      // Labels
      const label = g
        .append("g")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text((d: any) => (d.title.length > 25 ? d.title.slice(0, 25) + "..." : d.title))
        .attr("font-size", 8)
        .attr("fill", "#A09CC0")
        .attr("text-anchor", "middle")
        .attr("dy", (d: any) => d.radius + 12)
        .attr("pointer-events", "none");

      // Hover
      node
        .on("mouseover", (event: any, d: any) => {
          const connected = new Set<string>();
          links.forEach((l: any) => {
            const sid = typeof l.source === "object" ? l.source.id : l.source;
            const tid = typeof l.target === "object" ? l.target.id : l.target;
            if (sid === d.id) connected.add(tid);
            if (tid === d.id) connected.add(sid);
          });
          connected.add(d.id);

          node.attr("opacity", (n: any) => (connected.has(n.id) ? 1 : 0.15));
          link.attr("opacity", (l: any) => {
            const sid = typeof l.source === "object" ? l.source.id : l.source;
            const tid = typeof l.target === "object" ? l.target.id : l.target;
            return sid === d.id || tid === d.id ? 1 : 0.05;
          });
          label.attr("opacity", (n: any) => (connected.has(n.id) ? 1 : 0.15));

          d3.select(event.currentTarget).attr("stroke", "#818CF8").attr("stroke-width", 3);
        })
        .on("mouseout", (event: any) => {
          node.attr("opacity", 1);
          link.attr("opacity", 0.6);
          label.attr("opacity", 1);
          d3.select(event.currentTarget).attr("stroke", "#0B0A1A").attr("stroke-width", 1.5);
        })
        .on("click", (_event: any, d: any) => {
          const reg = nodeMap.get(d.id);
          if (reg) setSelectedNode(reg);
        });

      simulation.on("tick", () => {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);
        node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
        label.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
      });
    })();

    return () => {
      destroyed = true;
    };
  }, [isMobile, filteredNodes, filteredEdges, connectionCount]);
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="border-b border-border px-4 py-3 space-y-3 shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <Network className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-sm font-semibold">Regulation Dependency Graph</h1>
          <span className="text-xs text-muted-foreground">
            {filteredNodes.length} regulations &middot; {filteredEdges.length} connections
          </span>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search regulations..."
              className="w-full h-8 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Region filters */}
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((region) => (
            <button
              key={region}
              onClick={() => setRegionFilter(region)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                regionFilter === region
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {region !== "All" && (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: REGION_COLORS[region] }}
                />
              )}
              {region}
            </button>
          ))}
        </div>

        {/* Relationship type filters */}
        <div className="flex flex-wrap gap-1.5">
          {REL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setRelFilter(type)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                relFilter === type
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
              }`}
            >
              {type === "All" ? "All Types" : EDGE_LABELS[type] || type}
            </button>
          ))}
        </div>
      </div>

      {/* Graph or mobile list */}
      <div className="flex-1 overflow-hidden relative">
        {!isMobile ? (
          <>
            <svg
              ref={svgRef}
              className="w-full h-full bg-[var(--bg-primary)]"
            />

            {/* Detail panel */}
            {selectedNode && (
              <div className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] overflow-y-auto bg-card border border-border rounded-xl shadow-xl p-4 z-10">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold pr-6 leading-snug">
                    {selectedNode.title}
                  </h3>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 rounded hover:bg-muted shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground">
                    {selectedNode.jurisdiction_display}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground">
                    {selectedNode.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-3">
                  {selectedNode.summary}
                </p>

                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Connections ({getConnections(selectedNode.id).length})
                  </p>
                  {getConnections(selectedNode.id).map((conn) => (
                    <div
                      key={conn.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <span
                        className="shrink-0 mt-1 w-2 h-2 rounded-full"
                        style={{
                          backgroundColor:
                            EDGE_COLORS[conn.relationship_type] || "#4B5563",
                        }}
                      />
                      <div>
                        <span className="text-muted-foreground">
                          {conn.direction === "outgoing" ? "→" : "←"}{" "}
                          {EDGE_LABELS[conn.relationship_type]}
                        </span>{" "}
                        <span className="font-medium">{conn.otherTitle}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          ({conn.otherJurisdiction})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Link
                  href="/feed"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View in Feed <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </>
        ) : (
          /* Mobile list view */
          <div className="h-full overflow-y-auto p-4 space-y-2">
            {filteredNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No regulations match your filters
              </p>
            ) : (
              filteredNodes
                .sort((a, b) => (connectionCount.get(b.id) || 0) - (connectionCount.get(a.id) || 0))
                .map((reg) => {
                  const conns = getConnections(reg.id);
                  const expanded = expandedMobile === reg.id;
                  return (
                    <div
                      key={reg.id}
                      className="border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedMobile(expanded ? null : reg.id)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                      >
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor:
                              REGION_COLORS[getRegion(reg.jurisdiction)] || "#8B87B8",
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {reg.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reg.jurisdiction_display} &middot;{" "}
                            {conns.length} connections
                          </p>
                        </div>
                        {expanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </button>
                      {expanded && (
                        <div className="border-t border-border px-3 py-2 space-y-1.5 bg-muted/20">
                          {conns.map((conn) => (
                            <div
                              key={conn.id}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span
                                className="shrink-0 mt-1 w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    EDGE_COLORS[conn.relationship_type] || "#4B5563",
                                }}
                              />
                              <div>
                                <span className="text-muted-foreground">
                                  {conn.direction === "outgoing" ? "→" : "←"}{" "}
                                  {EDGE_LABELS[conn.relationship_type]}
                                </span>{" "}
                                <span className="font-medium">
                                  {conn.otherTitle}
                                </span>
                              </div>
                            </div>
                          ))}
                          {conns.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No connections
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
