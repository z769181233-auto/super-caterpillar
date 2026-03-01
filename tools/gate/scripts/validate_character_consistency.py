#!/usr/bin/env python3
"""
V3.0 P0-2: Character Consistency Validator
验证角色状态在连续场景中的一致性（衣着、道具不漂移）
"""
import json
import sys
import re


def load_snapshots(path):
    """加载 graph_state_snapshot JSON 数组"""
    with open(path, "r", encoding="utf-8") as f:
        raw = f.read().strip()
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("SNAPSHOT JSON must be a list")
    return data


def normalize_char(c):
    """标准化角色数据结构"""
    cid = c.get("id") or c.get("char_id") or c.get("characterId") or c.get("name")
    name = c.get("name") or cid
    appearance = c.get("appearance") or {}
    clothing = appearance.get("clothing") or c.get("clothing")
    items = c.get("items") or []
    if isinstance(items, str):
        items = [items]
    return {
        "id": str(cid),
        "name": str(name),
        "clothing": clothing,
        "items": sorted([str(x) for x in items]),
    }


def extract_characters(snapshot_obj):
    """从快照对象中提取角色列表"""
    snap = snapshot_obj.get("graph_state_snapshot") or {}
    chars = snap.get("characters") or []
    if not isinstance(chars, list):
        chars = []
    return {normalize_char(c)["id"]: normalize_char(c) for c in chars}


def main():
    if len(sys.argv) < 2:
        raise SystemExit(
            "Usage: validate_character_consistency.py <GRAPH_STATE_SNAPSHOT.json>"
        )

    snaps = load_snapshots(sys.argv[1])
    if len(snaps) < 2:
        # 如果只有一个快照，无法比较一致性
        print(
            json.dumps(
                [
                    {
                        "status": "INCONSISTENT",
                        "reason": "Need at least 2 snapshots to compare",
                    }
                ],
                ensure_ascii=False,
                indent=2,
            )
        )
        sys.exit(1)

    # 比较最新的两个快照
    a = extract_characters(snaps[0])
    b = extract_characters(snaps[1])

    diffs = []
    shared_ids = set(a.keys()) & set(b.keys())
    
    if not shared_ids:
        diffs.append(
            {
                "status": "INCONSISTENT",
                "reason": "No shared character ids between snapshots",
            }
        )
    else:
        for cid in sorted(shared_ids):
            ca, cb = a[cid], b[cid]
            
            # 检查 clothing 一致性
            if ca["clothing"] and cb["clothing"] and ca["clothing"] != cb["clothing"]:
                diffs.append(
                    {
                        "status": "INCONSISTENT",
                        "character": ca["name"],
                        "field": "clothing",
                        "snapshot_a": ca["clothing"],
                        "snapshot_b": cb["clothing"],
                    }
                )
            
            # 检查 items 一致性
            if ca["items"] and cb["items"] and ca["items"] != cb["items"]:
                diffs.append(
                    {
                        "status": "INCONSISTENT",
                        "character": ca["name"],
                        "field": "items",
                        "snapshot_a": ca["items"],
                        "snapshot_b": cb["items"],
                    }
                )

    if diffs:
        print(json.dumps(diffs, ensure_ascii=False, indent=2))
        sys.exit(1)

    print(
        json.dumps(
            [{"status": "CONSISTENT", "shared_characters": len(shared_ids)}],
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
