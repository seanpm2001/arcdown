import MarkdownIt from 'markdown-it'
import markdownItExternalAnchor from 'markdown-it-external-anchor'
import markdownItAnchor from 'markdown-it-anchor'
import markdownItToc from 'markdown-it-toc-done-right'
import matter from 'gray-matter'

import markdownItClass from './vendor/markdown-it-class.cjs'

import { Highlighter } from './lib/highlighter.js'
import findLanguages from './lib/findLanguages.js'
import slugify from './lib/slugify.js'

export class Arcdown {
  static slugify = slugify
  static findLanguages = findLanguages

  #tocHtml = ''
  #defaultPlugins = {
    markdownItClass,
    markdownItExternalAnchor,
    markdownItAnchor: [ markdownItAnchor, { slugify, tabIndex: false } ],
    markdownItToc: [
      markdownItToc,
      {
        slugify,
        callback: (html) => {
          this.#tocHtml = html
        },
      },
    ],
  }

  /**
   * @param {import('../types').RendererOptions} [options] - arcdown options
   */
  constructor (options = {}) {
    const { hljs = {}, markdownIt = {}, pluginOverrides = {}, plugins = {}, renderer = null } =
      options

    // don't apply classes if missing mapping
    if (!pluginOverrides.markdownItClass) {
      pluginOverrides.markdownItClass = false
    }

    this.hljsOptions = hljs
    this.mditOptions = markdownIt
    this.mditPluginOverrides = pluginOverrides
    this.mditAddedPlugins = plugins
    this.customRenderer = !!renderer

    this.highlighter = new Highlighter(this.hljsOptions)

    const mdit =
      renderer || new MarkdownIt({
        linkify: true,
        html: true,
        typographer: true,
        ...this.mditOptions,
      })

    if (typeof mdit.use === 'function') {
      const allPlugins = { ...this.#defaultPlugins, ...this.mditAddedPlugins }
      for (const mdPlugin in allPlugins) {
        // skip disabled plugins
        if (
          (mdPlugin in this.mditPluginOverrides) && this.mditPluginOverrides[mdPlugin] === false
        ) {
          continue
        }

        const plugin = allPlugins[mdPlugin]
        let pluginFn = plugin
        let pluginOptions = {}

        if (Array.isArray(plugin)) {
          [ pluginFn, pluginOptions ] = plugin
        }

        mdit.use(pluginFn, {
          ...pluginOptions,
          ...this.mditPluginOverrides[mdPlugin],
        })
      }
    }

    this.renderer = mdit
  }

  async render (mdContent) {
    const { content, data: frontmatter } = matter(mdContent)

    if (!this.customRenderer) {
      const foundLanguages = findLanguages(content)
      const highlight = await this.highlighter.createHighlightFn(foundLanguages)
      this.renderer.set({ highlight })
    }

    const html = this.renderer.render(content)

    let { slug, title } = frontmatter
    if (!slug && title) {
      slug = slugify(title)
    }

    return {
      title,
      slug,
      frontmatter,
      html,
      tocHtml: this.#tocHtml,
    }
  }
}
