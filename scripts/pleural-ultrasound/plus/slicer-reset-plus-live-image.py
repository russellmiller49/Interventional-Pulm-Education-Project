"""Remove stale Image_Reference and reconnect Slicer to the live PLUS stream.

Run from Slicer's Python Interactor:

exec(open("/Users/russellmiller/Projects/Interventional-Pulm-Education-Project/scripts/pleural-ultrasound/plus/slicer-reset-plus-live-image.py").read())
"""

import slicer  # type: ignore


HOST = "localhost"
PORT = 18944


def find_node(name):
    try:
        return slicer.util.getNode(name)
    except slicer.util.MRMLNodeNotFoundException:
        return None


def remove_stale_image():
    node = find_node("Image_Reference")
    if node is None:
        print("No existing Image_Reference node found.")
        return
    slicer.mrmlScene.RemoveNode(node)
    print("Removed stale Image_Reference node.")


def get_connector():
    connectors = slicer.util.getNodesByClass("vtkMRMLIGTLConnectorNode")
    for connector in connectors:
        if connector.GetName() in ("PleuralPLUSConnector", "IGTLConnector"):
            return connector

    connector = slicer.mrmlScene.AddNewNodeByClass(
        "vtkMRMLIGTLConnectorNode",
        "PleuralPLUSConnector",
    )
    return connector


def restart_connector(connector):
    try:
        connector.Stop()
    except Exception:
        pass
    connector.SetTypeClient(HOST, PORT)
    connector.Start()
    print(f"Connector {connector.GetName()} restarted as client {HOST}:{PORT}.")


def main():
    remove_stale_image()
    connector = get_connector()
    restart_connector(connector)
    print("Wait 1-2 seconds. A new live Image_Reference node should appear.")


main()
