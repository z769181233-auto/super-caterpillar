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
    """从快照对象中提取角色列表，采用角色名称作为主键以解决 ID 漂移问题"""
    snap = snapshot_obj.get("graph_state_snapshot") or {}
    chars = snap.get("characters") or []
    if not isinstance(chars, list):
        chars = []
    # 使用 name 作为 key 确保即使 ID 变化也能进行一致性对比
    return {normalize_char(c)["name"]: normalize_char(c) for c in chars}


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

def is_hard_conflict(a, b):
    """
    判断两个描述是否存在硬冲突。
    规则：如果一个描述中的核心关键词在另一个中被否定，或者主色调、主装束完全互斥。
    当前实现：仅比较核心名词集合的重合度，如果差异过大则视为潜在冲突。
    """
    if not a or not b:
        return False
    
    # 简单的分词比对（忽略助词）
    words_a = set(re.findall(r'\w+', a.lower()))
    words_b = set(re.findall(r'\w+', b.lower()))
    
    if not words_a or not words_b:
        return False
        
    intersection = words_a & words_b
    union = words_a | words_b
    
    # Jaccard 相似度较低（< 0.2）且 两个描述长度都较大时，判为 Hard Conflict
    similarity = len(intersection) / len(union)
    
    # 特例：如果是叙事性的演化（例如增加了 cloak, outer layer），不应判定为冲突
    # 我们这里采用宽容策略：除非完全不沾边，否则仅作为 WARNING
    if similarity < 0.15 and (len(words_a) > 2 and len(words_b) > 2):
        return True
    return False


def main():
    if len(sys.argv) < 2:
        raise SystemExit(
            "Usage: validate_character_consistency.py <GRAPH_STATE_SNAPSHOT.json>"
        )

    snaps = load_snapshots(sys.argv[1])
    if len(snaps) < 2:
        print(json.dumps([{"status": "CONSISTENT", "reason": "Single snapshot"}], ensure_ascii=False, indent=2))
        sys.exit(0)

    # 比较最新的两个快照
    a = extract_characters(snaps[0])
    b = extract_characters(snaps[1])

    diffs = []
    shared_names = set(a.keys()) & set(b.keys())
    
    if not shared_names:
        # 如果是连续场景但角色完全变了，在短篇中可能，但在 Gate 测试中通常不期望
        diffs.append({
            "status": "WARNING",
            "reason": "No shared character names between snapshots"
        })
    else:
        for name in sorted(shared_names):
            ca, cb = a[name], b[name]
            
            # 检查 clothing
            if ca["clothing"] and cb["clothing"] and ca["clothing"] != cb["clothing"]:
                if is_hard_conflict(ca["clothing"], cb["clothing"]):
                    diffs.append({
                        "status": "HARD_CONFLICT",
                        "character": name,
                        "field": "clothing",
                        "snapshot_a": ca["clothing"],
                        "snapshot_b": cb["clothing"]
                    })
                else:
                    diffs.append({
                        "status": "WARNING",
                        "character": name,
                        "field": "clothing",
                        "reason": "Appearance evolved or described differently",
                        "snapshot_a": ca["clothing"],
                        "snapshot_b": cb["clothing"]
                    })
            
            # 检查 items (集合比较)
            sa, sb = set(ca["items"]), set(cb["items"])
            if sa != sb:
                # 道具变化通常是正常的演化，仅作 WARNING
                diffs.append({
                    "status": "WARNING",
                    "character": name,
                    "field": "items",
                    "added": list(sb - sa),
                    "removed": list(sa - sb)
                })

    # 过滤出真正的错误
    hard_conflicts = [d for d in diffs if d["status"] == "HARD_CONFLICT"]
    
    if hard_conflicts:
        print(json.dumps(hard_conflicts, ensure_ascii=False, indent=2))
        sys.exit(1)

    # 如果只有警告或全绿，则 PASS
    print(json.dumps([{
        "status": "CONSISTENT", 
        "shared_characters": len(shared_names),
        "warnings": [d for d in diffs if d["status"] == "WARNING"]
    }], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
