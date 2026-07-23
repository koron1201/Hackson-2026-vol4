import { afterEach } from 'vitest'
import { config } from '@vue/test-utils'

afterEach(() => {
  localStorage.clear()
})

config.global.stubs = {
  RouterLink: {
    template: '<a><slot /></a>',
  },
}
