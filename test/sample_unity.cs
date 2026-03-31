using UnityEngine;
using System.Collections;

namespace SampleUnity
{
    // CQE009 violations: public fields should use [SerializeField] private
    // CQE010 violation: has both Awake and Start
    public class PlayerController : MonoBehaviour
    {
        // CQE009: should be [SerializeField] private
        public float speed;

        // CQE009: should be [SerializeField] private
        public int health;

        // OK: already [SerializeField] private
        [SerializeField] private float _jumpForce;

        // OK: private field
        private bool _isGrounded;

        // OK: public const is fine
        public const int MaxHealth = 100;

        // CQE010 warning: both Awake and Start present
        void Awake()
        {
            _isGrounded = false;
        }

        void Start()
        {
            speed = 5.0f;
            health = MaxHealth;
        }

        void Update()
        {
            // CQE008: magic number 9.81
            float gravity = 9.81f;

            if (_isGrounded)
            {
                // CQE005: variable not camelCase
                float JumpHeight = _jumpForce * 2; // CQE008: magic number 2
            }
        }
    }

    // CQE010 warning: has Unity callbacks but no Awake/Start
    public class EnemyAI : MonoBehaviour
    {
        // CQE009: public field
        public float aggroRange;

        // CQE009: public field
        public GameObject target;

        [Header("Settings")]
        [SerializeField] private float _attackCooldown;

        void Update()
        {
            // CQE008: magic number 10
            if (aggroRange < 10)
            {
                // attack logic
            }
        }

        void OnDestroy()
        {
            // cleanup
        }
    }

    // Clean class — no warnings expected for CQE010
    public class GameSettings
    {
        private int _volume;

        public int GetVolume()
        {
            return _volume;
        }
    }
}
