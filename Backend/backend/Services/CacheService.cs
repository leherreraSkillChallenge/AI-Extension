using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;

namespace Backend.Services
{
    public class CacheService
    {
        private readonly ConcurrentDictionary<string, CacheItem> _cache = new();
        private readonly TimeSpan _cacheDuration = TimeSpan.FromMinutes(5);

        public async Task<T?> GetOrSetAsync<T>(string key, Func<Task<T?>> factory) where T : class
        {
            if (_cache.TryGetValue(key, out var cachedItem) && 
                cachedItem.ExpiresAt > DateTime.UtcNow)
            {
                return cachedItem.Value as T;
            }

            var value = await factory();
            if (value != null)
            {
                _cache[key] = new CacheItem
                {
                    Value = value,
                    ExpiresAt = DateTime.UtcNow.Add(_cacheDuration)
                };
            }

            return value;
        }

        public void ClearExpired()
        {
            var now = DateTime.UtcNow;
            var expiredKeys = new List<string>();

            foreach (var kvp in _cache)
            {
                if (kvp.Value.ExpiresAt <= now)
                {
                    expiredKeys.Add(kvp.Key);
                }
            }

            foreach (var key in expiredKeys)
            {
                _cache.TryRemove(key, out _);
            }
        }

        private class CacheItem
        {
            public object Value { get; set; } = null!;
            public DateTime ExpiresAt { get; set; }
        }
    }
}
