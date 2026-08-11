import { describe, expect, test } from 'bun:test'
import { codeFromResourceDirectory, parseStringsXml } from './build-i18n.mjs'

describe('Android i18n catalog generator', () => {
  test('normalizes Android locale qualifiers to BCP-47 tags', () => {
    expect(codeFromResourceDirectory('values')).toBe('en')
    expect(codeFromResourceDirectory('values-lt')).toBe('lt')
    expect(codeFromResourceDirectory('values-pt-rBR')).toBe('pt-BR')
    expect(codeFromResourceDirectory('values-b+sr+Latn')).toBe('sr-Latn')
  })

  test('decodes XML and Android escapes while skipping non-plain resources', () => {
    const xml = String.raw`<resources>
      <string name="message">It\'s \"fine\"\n&amp; &lt; %1$s \u263A</string>
      <string name="ignored" translatable="false">Skip me</string>
      <plurals name="count"><item quantity="other">Items</item></plurals>
    </resources>`

    expect(parseStringsXml(xml)).toEqual({
      message: 'It\'s "fine"\n& < %1$s ☺',
    })
  })

  test('rejects quote entities that aapt2 does not accept', () => {
    const xml = '<resources><string name="message">&quot;bad&quot;</string></resources>'
    expect(() => parseStringsXml(xml, 'bad.xml')).toThrow('use Android escapes')
  })
})
