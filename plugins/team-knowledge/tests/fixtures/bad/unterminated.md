---
type: Practice
title: Unterminated frontmatter
description: The frontmatter block never closes.
tags: [testing]
status: stable

# 规则

Rule 1 of §11 rejects this: the `---` block is never terminated, so nothing after
it can be trusted to be frontmatter or body.
