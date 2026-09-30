import { StylesConfig } from 'react-select'

export const customSelectStyles: StylesConfig<any, boolean> = {
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? '#4f46e5' : '#cbd5e1',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    minHeight: '38px',
    boxShadow: state.isFocused ? '0 0 0 1px #4f46e5' : 'none',
    '&:hover': { borderColor: '#4f46e5' },
    backgroundColor: '#ffffff'
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.5rem',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    zIndex: 50,
    fontSize: '0.875rem',
    overflow: 'hidden'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#4f46e5'
      : state.isFocused
      ? '#eef2ff'
      : 'transparent',
    color: state.isSelected ? '#ffffff' : '#1e293b',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#4338ca' }
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1e293b',
    fontWeight: 500
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8'
  })
}
