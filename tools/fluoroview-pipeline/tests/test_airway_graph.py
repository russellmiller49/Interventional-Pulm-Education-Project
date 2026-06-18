import json

from fluoroview_pipeline.airway_graph import build_airway_graph


def write_curve(path, name, points):
    payload = {
        "markups": [
            {
                "type": "Curve",
                "coordinateSystem": "LPS",
                "controlPoints": [
                    {"label": f"{name}-{index}", "position": point}
                    for index, point in enumerate(points, start=1)
                ],
            }
        ]
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def test_build_airway_graph_merges_curve_endpoints_and_marks_carina(tmp_path):
    (tmp_path / "Network properties.tsv").write_text(
        "CellId\tLength\tRadius\n0\t10\t7\n1\t11\t5\n2\t12\t5\n",
        encoding="utf-8",
    )
    write_curve(tmp_path / "Network curve (0).mrk.json", "Network curve (0)", [[0, 0, 0], [0, 0, -10]])
    write_curve(
        tmp_path / "Network curve (1).mrk.json",
        "Network curve (1)",
        [[0, 0, -10], [10, 0, -20]],
    )
    write_curve(
        tmp_path / "Network curve (2).mrk.json",
        "Network curve (2)",
        [[0, 0, -10], [-10, 0, -20]],
    )

    graph = build_airway_graph(tmp_path)

    assert graph["schema"] == "fluoroview_airway_graph/v1"
    assert graph["rootNodeId"] == 0
    assert graph["carinaNodeId"] == 1
    assert graph["carinaLpsMm"] == (0.0, 0.0, -10.0)
    assert len(graph["edges"]) == 3
    assert len(graph["terminalNodeIds"]) == 2
    assert graph["nodes"][1]["kind"] == "carina"
    assert set(graph["nodes"][1]["childEdgeIds"]) == {1, 2}


def test_build_airway_graph_prefers_network_curves_when_centerline_curves_are_present(tmp_path):
    (tmp_path / "Network properties.tsv").write_text(
        "CellId\tLength\tRadius\n0\t10\t7\n1\t11\t5\n",
        encoding="utf-8",
    )
    write_curve(
        tmp_path / "Centerline curve_1 (0).mrk.json",
        "Centerline curve_1 (0)",
        [[100, 0, 0], [100, 0, -10]],
    )
    write_curve(
        tmp_path / "Network curve_1 (0).mrk.json",
        "Network curve_1 (0)",
        [[0, 0, 0], [0, 0, -10]],
    )
    write_curve(
        tmp_path / "Network curve_1 (1).mrk.json",
        "Network curve_1 (1)",
        [[0, 0, -10], [10, 0, -20]],
    )

    graph = build_airway_graph(tmp_path)

    assert len(graph["edges"]) == 2
    assert [edge["sourceCurve"] for edge in graph["edges"]] == [
        "Network curve_1 (0).mrk",
        "Network curve_1 (1).mrk",
    ]
    assert graph["nodes"][0]["lps"] == (0.0, 0.0, 0.0)
