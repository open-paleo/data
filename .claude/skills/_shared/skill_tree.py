#!/usr/bin/env python3
"""Walks of the parsed tree.yml clade tree, shared by the skill scripts."""

_ABSENT = object()


def find_node(node, target):
    """Depth-first search for a named clade in the tree.

    A leaf clade's value is None, so absence is reported with a sentinel rather
    than with None.

    @param node - the current tree mapping
    @param target - the clade name to find
    @returns the clade's subtree mapping (None for a leaf), or _ABSENT
    """
    if isinstance(node, dict):
        for key, value in node.items():
            if key == target:
                return value
            found = find_node(value, target)
            if found is not _ABSENT:
                return found
    return _ABSENT


def node_names(node):
    """Collect every clade name at or below a tree node.

    @param node - the tree mapping to walk
    @returns a set of clade names
    """
    names = set()
    if isinstance(node, dict):
        for key, value in node.items():
            names.add(key)
            names |= node_names(value)
    return names


def subtree_names(tree, root):
    """Return the root plus every clade below it.

    @param tree - the whole parsed tree.yml mapping
    @param root - the clade name to root the subtree at
    @returns a set of clade names, or None when the root is not in the tree
    """
    subtree = find_node(tree, root)
    if subtree is _ABSENT:
        return None
    return node_names(subtree) | {root}
