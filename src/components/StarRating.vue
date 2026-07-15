<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: number | null;
  max?: number;
  editable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:value', val: number | null): void;
}>();

const maxStars = computed(() => props.max ?? 10);

function handleClick(star: number) {
  if (props.editable) {
    emit('update:value', props.value === star ? null : star);
  }
}
</script>

<template>
  <span class="star-rating">
    <span
      v-for="i in maxStars"
      :key="i"
      class="star"
      :class="{ filled: value !== null && i <= value, clickable: editable }"
      @click="handleClick(i)"
    >★</span>
  </span>
</template>

<style scoped>
.star-rating {
  display: inline-flex;
  gap: 1px;
}
.star {
  font-size: 14px;
  color: var(--star-empty);
  user-select: none;
}
.star.filled {
  color: var(--warn);
}
.star.clickable {
  cursor: pointer;
}
.star.clickable:hover {
  color: var(--warn);
}
</style>
