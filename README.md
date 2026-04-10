# TheAdrianBlog — Author Guide

Everything you need to write, style, and publish posts.

---

## How publishing works

Every post is a `.md` (Markdown) file inside `content/posts/`. When you commit a new or edited file to GitHub, the site rebuilds and goes live automatically in a bout 60 seconds. That's it — no dashboard, no CMS, no build limits.

---

## Creating a new post

1. Go to your repo on GitHub
2. Navigate to `content/posts/`
3. Click **Add file → Create new file**
4. Name it something like `my-post-title.md`
5. Paste the template from `POST-TEMPLATE.md` and fill it in
6. Click **Commit changes**

The site will rebuild and your post will be live within a minute.

---

## Post frontmatter (the bit at the top)

Every post starts with a block between `---` lines called frontmatter. This controls how the post appears on the site.

```yaml
---
date: 27/03/2026
title: "Your Post Title Here"
summary: 'A short one or two sentence description shown on the card.'
categories:
  - General
image: posts/your-image.jpg
draft: false
---
```

### Fields explained

| Field | What it does | Required |
|-------|-------------|----------|
| `date` | Shown on the card and post. Format: DD/MM/YYYY | Yes |
| `title` | The post title. Use double quotes. | Yes |
| `summary` | Preview text shown on the card. Keep it under 200 characters. Use single quotes `'...'` if your text contains double quotes. | Yes |
| `categories` | One or more from: `General`, `Tech`, `Music Reviews` | Yes |
| `image` | Path to the preview image (see Images section below) | Yes |
| `draft` | Set to `true` to hide the post without deleting it | No |

### Multiple categories

```yaml
categories:
  - Tech
  - General
```

### Hiding a post (draft mode)

```yaml
draft: true
```

The post stays in your repo but won't appear on the site.

---

## Writing the post body

Everything below the second `---` is your post content, written in Markdown.

### Headings

```markdown
## This is a section heading (shows in cyan)

### This is a sub-heading (shows in purple)
```

### Paragraphs

Just write text. Leave a blank line between paragraphs.

```markdown
This is my first paragraph. It can be as long as I want.

This is a second paragraph after a blank line.
```

### Bold and italic

```markdown
**this text is bold**

*this text is italic*
```

### Links

```markdown
[link text](https://example.com)
```

### Blockquote (styled with purple accent)

```markdown
> This is a pull quote or notable line. It gets a purple left border.
```

### Code (inline)

```markdown
Use `backticks` for inline code snippets.
```

### Code block

````markdown
```
Your code here
Multi-line is fine
```
````

### Horizontal rule (divider line)

```markdown
---
```

### Lists

```markdown
- Item one
- Item two
- Item three

1. First
2. Second
3. Third
```

---

## Images in the post body

To add an image inside the post content:

1. Upload the image to the `public/posts/` folder in your repo
2. Reference it like this in your post:

```markdown
![Description of image](/posts/my-image.jpg)
```

---

## Preview images (card thumbnails)

The image shown on the post card and at the top of the post detail page.

### Adding a preview image

1. Upload your image to `public/posts/` in your repo (click `public` → `posts` → **Add file → Upload files**)
2. Set the `image` field in your frontmatter:

```yaml
image: posts/my-photo.jpg
```

### Image tips

- **Recommended size:** 1200×630px (standard blog/social preview ratio)
- **Format:** JPG or PNG — JPG is smaller and loads faster
- **If you have no image:** use `image: placeholder.png` and a grey placeholder shows instead
- **Good free image sources:** [Unsplash](https://unsplash.com), [Pexels](https://pexels.com) — both free to use

---

## Favicon (the icon in the browser tab)

1. Create or find a square image for your favicon (your logo, initials, anything)
2. Go to [favicon.io](https://favicon.io) and generate a favicon from text, image, or emoji — it's free
3. Download the zip from favicon.io
4. Upload `favicon.ico` to the `public/` folder in your repo
5. That's it — it'll appear in the browser tab automatically

---

## Common mistakes to avoid

**Quotes inside quotes** — if your summary contains double quotes `"`, wrap the whole summary in single quotes:
```yaml
summary: 'He said "this is great" and I agreed.'   ✓
summary: "He said "this is great""                  ✗ (breaks)
```

**Long summaries** — keep summaries short. If the text gets cut off in the GitHub editor, your YAML will break. One or two sentences max.

**Forgetting the closing `---`** — the frontmatter needs three dashes at the start AND end.

**Spaces in image filenames** — use hyphens instead of spaces: `my-photo.jpg` not `my photo.jpg`

---

## Folder structure reference

```
content/
  posts/
    welcome.md          ← your posts go here
    my-new-post.md

public/
  posts/
    my-image.jpg        ← post images go here
  placeholder.png       ← default image when none set
  favicon.ico           ← browser tab icon
```
